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
import {
  createBrand,
  deleteBrand,
  getAdminBrands,
  updateBrand,
  type AdminBrand,
} from '@/services/adminApi';

export default function AdminBrandsScreen() {
  const router = useRouter();
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<AdminBrand | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (q?: string) => {
    try {
      setRefreshing(true);
      const data = await getAdminBrands(q);
      setBrands(data);
    } catch (e: any) {
      console.error('Admin brands error:', e?.message);
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

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setIsActive(true);
    setModalVisible(true);
  };

  const openEdit = (brand: AdminBrand) => {
    setEditing(brand);
    setName(brand.name);
    setDescription(brand.description);
    setIsActive(brand.is_active);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    setSaving(true);
    try {
      const data = { name: name.trim(), description: description.trim(), is_active: isActive };
      if (editing) {
        await updateBrand(editing.id, data);
      } else {
        await createBrand(data);
      }
      Alert.alert('Success', `Brand ${editing ? 'updated' : 'created'} successfully`);
      setModalVisible(false);
      load(query);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (brand: AdminBrand) => {
    Alert.alert(
      'Delete Brand',
      `Are you sure you want to delete "${brand.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBrand(brand.id);
              Alert.alert('Success', 'Brand deleted');
              load(query);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || 'Failed to delete');
            }
          },
        },
      ],
    );
  };

  const showActions = (brand: AdminBrand) => {
    Alert.alert(brand.name, 'Choose an action', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => openEdit(brand) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(brand) },
    ]);
  };

  const renderItem = ({ item }: { item: AdminBrand }) => (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => showActions(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.brandName} numberOfLines={1}>{item.name}</Text>
        <View style={[styles.badge, { backgroundColor: (item.is_active ? Brand.primary : Brand.textTertiary) + '20' }]}>
          <Text style={[styles.badgeText, { color: item.is_active ? Brand.primary : Brand.textTertiary }]}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      <Text style={styles.slug}>/{item.slug}</Text>
      {item.description ? <Text style={styles.description} numberOfLines={2}>{item.description}</Text> : null}
      <Text style={styles.metaText}>{item.product_count} products</Text>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <ModernHeader title="Brands" rightIcon="plus" onRightPress={openCreate} />
      <View style={styles.body}>
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color={Brand.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search brands..."
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
            data={brands}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(query)} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="tag-off-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No brands found</Text>
                <Text style={styles.emptySub}>Create one to get started</Text>
              </View>
            }
          />
        )}

        <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editing ? 'Edit Brand' : 'New Brand'}</Text>
                <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
                </Pressable>
              </View>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Brand name"
                placeholderTextColor={Brand.textTertiary}
              />
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.input, { minHeight: 80 }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Brand description"
                placeholderTextColor={Brand.textTertiary}
                multiline
                textAlignVertical="top"
              />
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Active</Text>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: Brand.border, true: Brand.primary }} />
              </View>
              <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} disabled={saving} onPress={handleSave}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
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
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  searchInput: { flex: 1, fontSize: 14, color: Brand.text, marginLeft: 8, paddingVertical: 0 },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  brandName: { fontSize: 15, fontWeight: '800', color: Brand.text, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  slug: { fontSize: 13, color: Brand.textSecondary, marginBottom: 4 },
  description: { fontSize: 13, color: Brand.textSecondary, marginBottom: 4 },
  metaText: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
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
