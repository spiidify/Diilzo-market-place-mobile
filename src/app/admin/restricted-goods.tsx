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
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import {
  createRestrictedGood,
  getAdminRestrictedGoods,
  type AdminRestrictedGood,
} from '@/services/adminApi';

const LEVEL_COLORS: Record<string, string> = {
  banned: Brand.danger,
  restricted: Brand.rating,
  conditional: '#3B82F6',
  permitted: Brand.primary,
};

export default function AdminRestrictedGoodsScreen() {
  const router = useRouter();
  const [goods, setGoods] = useState<AdminRestrictedGood[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countryFilter, setCountryFilter] = useState('');
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ country: '', restriction_level: 'restricted', description: '', permit_required: false, permit_authority: '', duty_rate: '', is_active: true });

  const load = useCallback(async (country?: string) => {
    try {
      setRefreshing(true);
      const data = await getAdminRestrictedGoods(country || undefined);
      setGoods(data);
    } catch (e: any) {
      console.error('Admin restricted goods error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (text: string) => {
    setCountryFilter(text);
    if (searchTimer) clearTimeout(searchTimer);
    const t = setTimeout(() => load(text), 400);
    setSearchTimer(t);
  };

  const handleCreate = async () => {
    if (!form.country.trim() || !form.description.trim()) {
      Alert.alert('Error', 'Country and description are required');
      return;
    }
    setSaving(true);
    try {
      await createRestrictedGood({
        country: form.country.trim(),
        restriction_level: form.restriction_level,
        description: form.description.trim(),
        permit_required: form.permit_required,
        permit_authority: form.permit_authority.trim(),
        duty_rate: form.duty_rate || '0',
        is_active: form.is_active,
      });
      Alert.alert('Success', 'Restricted good created successfully');
      setModalVisible(false);
      setForm({ country: '', restriction_level: 'restricted', description: '', permit_required: false, permit_authority: '', duty_rate: '', is_active: true });
      load(countryFilter);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: AdminRestrictedGood }) => {
    const color = LEVEL_COLORS[item.restriction_level] || Brand.textTertiary;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.countryText}>{item.country}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.restriction_level}</Text>
          </View>
        </View>
        <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
        <View style={styles.cardFooter}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {item.permit_required && (
              <View style={[styles.badge, { backgroundColor: Brand.accent + '20' }]}>
                <Text style={[styles.badgeText, { color: Brand.accent }]}>Permit</Text>
              </View>
            )}
            <Text style={styles.dutyText}>Duty: {item.duty_rate}%</Text>
          </View>
          {!item.is_active && (
            <View style={[styles.badge, { backgroundColor: Brand.textTertiary + '20' }]}>
              <Text style={[styles.badgeText, { color: Brand.textTertiary }]}>Inactive</Text>
            </View>
          )}
        </View>
        {item.permit_authority ? <Text style={styles.authorityText}>Authority: {item.permit_authority}</Text> : null}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="Restricted Goods" rightIcon="plus" onRightPress={() => setModalVisible(true)} />
      <View style={styles.body}>
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color={Brand.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter by country..."
            placeholderTextColor={Brand.textTertiary}
            value={countryFilter}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {countryFilter.length > 0 && (
            <Pressable onPress={() => { setCountryFilter(''); load(); }} hitSlop={12}>
              <MaterialCommunityIcons name="close-circle" size={20} color={Brand.textTertiary} />
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={goods}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(countryFilter)} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="shield-alert-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No restricted goods found</Text>
                <Text style={styles.emptySub}>Try a different country or create one</Text>
              </View>
            }
          />
        )}

        <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Restricted Good</Text>
                <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: '75%' }} showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Country</Text>
                <TextInput style={styles.input} value={form.country} onChangeText={(v) => setForm({ ...form, country: v })} placeholder="e.g. Uganda" placeholderTextColor={Brand.textTertiary} />
                <Text style={styles.fieldLabel}>Restriction Level</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {['banned', 'restricted', 'conditional', 'permitted'].map((l) => (
                    <Pressable key={l} style={[styles.levelTab, form.restriction_level === l && styles.levelTabActive]} onPress={() => setForm({ ...form, restriction_level: l })}>
                      <Text style={[styles.levelTabText, form.restriction_level === l && styles.levelTabTextActive]}>{l.charAt(0).toUpperCase() + l.slice(1)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput style={[styles.input, { minHeight: 80 }]} value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Description" placeholderTextColor={Brand.textTertiary} multiline textAlignVertical="top" />
                <Text style={styles.fieldLabel}>Duty Rate (%)</Text>
                <TextInput style={styles.input} value={form.duty_rate} onChangeText={(v) => setForm({ ...form, duty_rate: v })} placeholder="e.g. 25" placeholderTextColor={Brand.textTertiary} keyboardType="numeric" />
                <Text style={styles.fieldLabel}>Permit Authority</Text>
                <TextInput style={styles.input} value={form.permit_authority} onChangeText={(v) => setForm({ ...form, permit_authority: v })} placeholder="e.g. URA" placeholderTextColor={Brand.textTertiary} />
                <View style={styles.switchRow}>
                  <Text style={styles.fieldLabel}>Permit Required</Text>
                  <Switch value={form.permit_required} onValueChange={(v) => setForm({ ...form, permit_required: v })} trackColor={{ false: Brand.border, true: Brand.accent }} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.fieldLabel}>Active</Text>
                  <Switch value={form.is_active} onValueChange={(v) => setForm({ ...form, is_active: v })} trackColor={{ false: Brand.border, true: Brand.primary }} />
                </View>
                <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} disabled={saving} onPress={handleCreate}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Create'}</Text>
                </Pressable>
              </ScrollView>
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
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  searchInput: { flex: 1, fontSize: 14, color: Brand.text, marginLeft: 8, paddingVertical: 0 },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  countryText: { fontSize: 15, fontWeight: '800', color: Brand.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  description: { fontSize: 13, color: Brand.textSecondary, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dutyText: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  authorityText: { fontSize: 12, color: Brand.textTertiary, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Brand.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, padding: 12, fontSize: 14, color: Brand.text, marginBottom: 16 },
  levelTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Brand.surfaceAlt, borderWidth: 1, borderColor: Brand.border, marginRight: 8 },
  levelTabActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  levelTabText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  levelTabTextActive: { color: '#FFFFFF' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  saveBtn: { backgroundColor: Brand.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
