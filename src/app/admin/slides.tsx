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
  createSlide,
  deleteSlide,
  getAdminSlides,
  updateSlide,
  type AdminSlide,
} from '@/services/adminApi';

const POSITION_OPTIONS = ['home_top', 'home_mid', 'home_bottom', 'category_top'] as const;

export default function AdminSlidesScreen() {
  const router = useRouter();
  const [slides, setSlides] = useState<AdminSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<AdminSlide | null>(null);
  const [form, setForm] = useState({
    title: '',
    headline: '',
    subheadline: '',
    background_color: '#32C700',
    cta_text: '',
    cta_link: '',
    is_active: true,
    sort_order: 0,
    position: 'home_top',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getAdminSlides();
      setSlides(data);
    } catch (e: any) {
      console.error('Admin slides error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', headline: '', subheadline: '', background_color: '#32C700', cta_text: '', cta_link: '', is_active: true, sort_order: 0, position: 'home_top' });
    setModalVisible(true);
  };

  const openEdit = (slide: AdminSlide) => {
    setEditing(slide);
    setForm({
      title: slide.title,
      headline: slide.headline,
      subheadline: slide.subheadline,
      background_color: slide.background_color,
      cta_text: slide.cta_text,
      cta_link: slide.cta_link,
      is_active: slide.is_active,
      sort_order: slide.sort_order,
      position: slide.position,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateSlide(editing.id, form);
      } else {
        await createSlide(form);
      }
      Alert.alert('Success', `Slide ${editing ? 'updated' : 'created'} successfully`);
      setModalVisible(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (slide: AdminSlide) => {
    Alert.alert(
      'Delete Slide',
      `Are you sure you want to delete "${slide.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSlide(slide.id);
              Alert.alert('Success', 'Slide deleted');
              load();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || 'Failed to delete');
            }
          },
        },
      ],
    );
  };

  const showActions = (slide: AdminSlide) => {
    Alert.alert(slide.title, 'Choose an action', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => openEdit(slide) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(slide) },
    ]);
  };

  const renderItem = ({ item }: { item: AdminSlide }) => (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => showActions(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.slideTitle} numberOfLines={1}>{item.title}</Text>
        <View style={[styles.badge, { backgroundColor: (item.is_active ? Brand.primary : Brand.textTertiary) + '20' }]}>
          <Text style={[styles.badgeText, { color: item.is_active ? Brand.primary : Brand.textTertiary }]}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      <Text style={styles.headline}>{item.headline}</Text>
      {item.subheadline ? <Text style={styles.subheadline} numberOfLines={1}>{item.subheadline}</Text> : null}
      <View style={styles.cardFooter}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={[styles.posBadge, { backgroundColor: Brand.accent + '20' }]}>
            <Text style={[styles.badgeText, { color: Brand.accent }]}>{item.position.replace('_', ' ')}</Text>
          </View>
          <Text style={styles.metaText}>Sort: {item.sort_order}</Text>
        </View>
        {item.cta_text ? <Text style={styles.ctaText}>{item.cta_text}</Text> : null}
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <ModernHeader title="Slides" rightIcon="plus" onRightPress={openCreate} />
      <View style={styles.body}>
        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={slides}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="image-multiple-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No slides found</Text>
                <Text style={styles.emptySub}>Create one to get started</Text>
              </View>
            }
          />
        )}

        <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editing ? 'Edit Slide' : 'New Slide'}</Text>
                <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: '75%' }} showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Title</Text>
                <TextInput style={styles.input} value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} placeholder="Slide title" placeholderTextColor={Brand.textTertiary} />
                <Text style={styles.fieldLabel}>Headline</Text>
                <TextInput style={styles.input} value={form.headline} onChangeText={(v) => setForm({ ...form, headline: v })} placeholder="Headline" placeholderTextColor={Brand.textTertiary} />
                <Text style={styles.fieldLabel}>Subheadline</Text>
                <TextInput style={styles.input} value={form.subheadline} onChangeText={(v) => setForm({ ...form, subheadline: v })} placeholder="Subheadline" placeholderTextColor={Brand.textTertiary} />
                <Text style={styles.fieldLabel}>Background Color</Text>
                <TextInput style={styles.input} value={form.background_color} onChangeText={(v) => setForm({ ...form, background_color: v })} placeholder="#32C700" placeholderTextColor={Brand.textTertiary} />
                <Text style={styles.fieldLabel}>CTA Text</Text>
                <TextInput style={styles.input} value={form.cta_text} onChangeText={(v) => setForm({ ...form, cta_text: v })} placeholder="Shop Now" placeholderTextColor={Brand.textTertiary} />
                <Text style={styles.fieldLabel}>CTA Link</Text>
                <TextInput style={styles.input} value={form.cta_link} onChangeText={(v) => setForm({ ...form, cta_link: v })} placeholder="/shop" placeholderTextColor={Brand.textTertiary} />
                <Text style={styles.fieldLabel}>Sort Order</Text>
                <TextInput style={styles.input} value={String(form.sort_order)} onChangeText={(v) => setForm({ ...form, sort_order: Number(v) || 0 })} placeholder="0" placeholderTextColor={Brand.textTertiary} keyboardType="numeric" />
                <Text style={styles.fieldLabel}>Position</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {POSITION_OPTIONS.map((p) => (
                    <Pressable key={p} style={[styles.posTab, form.position === p && styles.posTabActive]} onPress={() => setForm({ ...form, position: p })}>
                      <Text style={[styles.posTabText, form.position === p && styles.posTabTextActive]}>{p.replace('_', ' ')}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.switchRow}>
                  <Text style={styles.fieldLabel}>Active</Text>
                  <Switch value={form.is_active} onValueChange={(v) => setForm({ ...form, is_active: v })} trackColor={{ false: Brand.border, true: Brand.primary }} />
                </View>
                <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} disabled={saving} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
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
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  slideTitle: { fontSize: 15, fontWeight: '800', color: Brand.text, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  headline: { fontSize: 14, fontWeight: '600', color: Brand.text, marginBottom: 2 },
  subheadline: { fontSize: 13, color: Brand.textSecondary, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  posBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  metaText: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  ctaText: { fontSize: 12, fontWeight: '700', color: Brand.primary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Brand.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, padding: 12, fontSize: 14, color: Brand.text, marginBottom: 16 },
  posTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Brand.surfaceAlt, borderWidth: 1, borderColor: Brand.border, marginRight: 8 },
  posTabActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  posTabText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  posTabTextActive: { color: '#FFFFFF' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  saveBtn: { backgroundColor: Brand.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
