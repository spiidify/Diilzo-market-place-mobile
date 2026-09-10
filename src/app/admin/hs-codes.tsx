import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import {
  createHSCode,
  getAdminHSCodes,
  type AdminHSCode,
} from '@/services/adminApi';

export default function AdminHSCodesScreen() {
  const router = useRouter();
  const [codes, setCodes] = useState<AdminHSCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', description: '', default_duty_rate: '', is_restricted: false, requires_export_license: false });

  const load = useCallback(async (q?: string) => {
    try {
      setRefreshing(true);
      const data = await getAdminHSCodes(q);
      setCodes(data);
    } catch (e: any) {
      console.error('Admin HS codes error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimer) clearTimeout(searchTimer);
    const t = setTimeout(() => load(text), 400);
    setSearchTimer(t);
  };

  const handleCreate = async () => {
    if (!form.code.trim() || !form.description.trim()) {
      Alert.alert('Error', 'Code and description are required');
      return;
    }
    setSaving(true);
    try {
      await createHSCode({
        code: form.code.trim(),
        description: form.description.trim(),
        default_duty_rate: form.default_duty_rate || '0',
        is_restricted: form.is_restricted,
        requires_export_license: form.requires_export_license,
      });
      Alert.alert('Success', 'HS Code created successfully');
      setModalVisible(false);
      setForm({ code: '', description: '', default_duty_rate: '', is_restricted: false, requires_export_license: false });
      load(query);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to create HS code');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: AdminHSCode }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.codeText}>{item.code}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {item.is_restricted && (
            <View style={[styles.badge, { backgroundColor: Brand.danger + '20' }]}>
              <Text style={[styles.badgeText, { color: Brand.danger }]}>Restricted</Text>
            </View>
          )}
          {item.requires_export_license && (
            <View style={[styles.badge, { backgroundColor: Brand.rating + '20' }]}>
              <Text style={[styles.badgeText, { color: Brand.rating }]}>License</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      <Text style={styles.dutyText}>Default Duty: {item.default_duty_rate}%</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.dark, Brand.darkLight, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>HS Codes</Text>
          <Pressable onPress={() => setModalVisible(true)} hitSlop={12}>
            <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>

        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color={Brand.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search HS codes..."
            placeholderTextColor={Brand.textTertiary}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); load(); }} hitSlop={12}>
              <MaterialCommunityIcons name="close-circle" size={20} color={Brand.textTertiary} />
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={codes}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(query)} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="barcode-scan" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No HS codes found</Text>
                <Text style={styles.emptySub}>Try a different search or create one</Text>
              </View>
            }
          />
        )}

        <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New HS Code</Text>
                <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Code</Text>
                <TextInput style={styles.input} value={form.code} onChangeText={(v) => setForm({ ...form, code: v })} placeholder="e.g. 0101.21" placeholderTextColor={Brand.textTertiary} />
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput style={[styles.input, { minHeight: 80 }]} value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Description" placeholderTextColor={Brand.textTertiary} multiline textAlignVertical="top" />
                <Text style={styles.fieldLabel}>Default Duty Rate (%)</Text>
                <TextInput style={styles.input} value={form.default_duty_rate} onChangeText={(v) => setForm({ ...form, default_duty_rate: v })} placeholder="e.g. 25" placeholderTextColor={Brand.textTertiary} keyboardType="numeric" />
                <View style={styles.switchRow}>
                  <Text style={styles.fieldLabel}>Restricted</Text>
                  <Switch value={form.is_restricted} onValueChange={(v) => setForm({ ...form, is_restricted: v })} trackColor={{ false: Brand.border, true: Brand.danger }} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.fieldLabel}>Requires Export License</Text>
                  <Switch value={form.requires_export_license} onValueChange={(v) => setForm({ ...form, requires_export_license: v })} trackColor={{ false: Brand.border, true: Brand.rating }} />
                </View>
                <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} disabled={saving} onPress={handleCreate}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Create'}</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.dark },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  searchInput: { flex: 1, fontSize: 14, color: Brand.text, marginLeft: 8, paddingVertical: 0 },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  codeText: { fontSize: 15, fontWeight: '800', color: Brand.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  description: { fontSize: 13, color: Brand.textSecondary, marginBottom: 4 },
  dutyText: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Brand.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, padding: 12, fontSize: 14, color: Brand.text, marginBottom: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  saveBtn: { backgroundColor: Brand.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
