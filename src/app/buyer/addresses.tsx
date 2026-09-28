import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { GradientHeader } from '@/components/GradientHeader';
import { LocationPicker } from '@/components/LocationPicker';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
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
  country_ref: null as number | null,
  region_ref: null as number | null,
  city_ref: null as number | null,
};

export default function BuyerAddressesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isAuthenticated } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await apiRequest<{ results: Address[] } | Address[]>({
        method: 'GET',
        url: '/auth/addresses/',
      });
      setAddresses(Array.isArray(data) ? data : data.results);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
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
      country_ref: (addr as any).country_ref || null,
      region_ref: (addr as any).region_ref || null,
      city_ref: (addr as any).city_ref || null,
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
    const meta = [
      [item.city, item.state].filter(Boolean).join(', '),
      item.postal_code,
      item.country,
      item.phone,
    ].filter(Boolean).join(' · ');
    return (
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name={labelMeta.icon} size={18} color={Brand.primary} />
        </View>
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.rowLabel}>{item.label}</Text>
            {item.is_default ? (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultText}>Default</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.street} numberOfLines={1}>{item.street}</Text>
          <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.iconBtn} onPress={() => openEdit(item)} hitSlop={4}>
            <MaterialCommunityIcons name="pencil-outline" size={17} color={Brand.primary} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => handleDelete(item.id)} hitSlop={4}>
            <MaterialCommunityIcons name="trash-can-outline" size={17} color={Brand.danger} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Addresses"
        subtitle={!loading && addresses.length > 0 ? `${addresses.length} saved` : undefined}
        rightIcon="plus"
        onRightPress={openAdd}
      />

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
            style={styles.listCard}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
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



      {/* Add/Edit Modal */}
      <Modal visible={showForm} animationType="slide" onRequestClose={closeForm}>
        <SafeAreaView edges={['top']} style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Pressable onPress={closeForm} hitSlop={12} style={styles.closeBtn}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
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
                        color={active ? '#FFFFFF' : colors.textSecondary}
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
                placeholderTextColor={colors.textTertiary}
                returnKeyType="next"
              />

              <View style={styles.rowTwo}>
                <View style={styles.col}>
                  <Text style={styles.sectionLabel}>Postal Code</Text>
                  <TextInput
                    style={styles.input}
                    value={form.postal_code}
                    onChangeText={(v) => update('postal_code', v)}
                    placeholder="00000"
                    placeholderTextColor={colors.textTertiary}
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Location picker (Alibaba-style hierarchy) */}
              <LocationPicker
                value={{
                  country_ref: form.country_ref,
                  region_ref: form.region_ref,
                  city_ref: form.city_ref,
                  country: form.country,
                  region: form.state,
                  city: form.city,
                }}
                onChange={(loc: any) => {
                  setForm((prev) => ({
                    ...prev,
                    country_ref: loc.country_ref ?? null,
                    region_ref: loc.region_ref ?? null,
                    city_ref: loc.city_ref ?? null,
                    country: loc.country ?? prev.country,
                    state: loc.region ?? prev.state,
                    city: loc.city ?? prev.city,
                  }));
                }}
              />

              <Text style={styles.sectionLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={form.phone}
                onChangeText={(v) => update('phone', v)}
                placeholder="+256 7XX XXX XXX"
                placeholderTextColor={colors.textTertiary}
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

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Brand.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  emptySubtitle: { marginTop: 6, fontSize: 14, color: c.textSecondary, textAlign: 'center' },
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
  listCard: { flex: 1 },
  list: {
    margin: 10, borderRadius: 14, overflow: 'hidden',
    backgroundColor: c.surface,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 10, paddingVertical: 9,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Brand.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: { fontSize: 13, fontWeight: '700', color: c.text, textTransform: 'capitalize' },
  defaultBadge: {
    backgroundColor: Brand.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  defaultText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  street: { fontSize: 12, color: c.text, fontWeight: '500' },
  meta: { fontSize: 11, color: c.textTertiary, fontWeight: '500' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 6 },
  rowDivider: { height: 1, backgroundColor: c.borderLight, marginLeft: 54 },
  // Modal (full screen)
  modalSafeArea: { flex: 1, backgroundColor: c.surface },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
    backgroundColor: c.surface,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: c.text },
  closeBtn: { padding: 4 },
  headerSpacer: { width: 24 },
  formAvoid: { flex: 1 },
  formScroll: { flex: 1 },
  formContent: { padding: 20, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textSecondary,
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: c.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: c.text,
    borderWidth: 1,
    borderColor: c.border,
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
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  labelChipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  labelChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textSecondary,
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
    backgroundColor: c.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.border,
  },
  toggleRowActive: {
    backgroundColor: Brand.primary + '12',
    borderColor: Brand.primary,
  },
  toggleTextWrap: { flex: 1, paddingRight: 12 },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: c.text },
  toggleSubtitle: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  togglePill: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.border,
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
