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
  createAnnouncement,
  deleteAnnouncement,
  getAdminAnnouncements,
  updateAnnouncement,
  type AdminAnnouncement,
} from '@/services/adminApi';

const AUDIENCE_OPTIONS = ['all', 'buyers', 'sellers', 'staff'] as const;

export default function AdminAnnouncementsScreen() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<AdminAnnouncement | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getAdminAnnouncements();
      setAnnouncements(data);
    } catch (e: any) {
      console.error('Admin announcements error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setMessage('');
    setAudience('all');
    setIsActive(true);
    setModalVisible(true);
  };

  const openEdit = (ann: AdminAnnouncement) => {
    setEditing(ann);
    setTitle(ann.title);
    setMessage(ann.message);
    setAudience(ann.target_audience);
    setIsActive(ann.is_active);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Error', 'Title and message are required');
      return;
    }
    setSaving(true);
    try {
      const data = { title: title.trim(), message: message.trim(), target_audience: audience, is_active: isActive };
      if (editing) {
        await updateAnnouncement(editing.id, data);
      } else {
        await createAnnouncement(data);
      }
      Alert.alert('Success', `Announcement ${editing ? 'updated' : 'created'} successfully`);
      setModalVisible(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (ann: AdminAnnouncement) => {
    Alert.alert(
      'Delete Announcement',
      `Are you sure you want to delete "${ann.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAnnouncement(ann.id);
              Alert.alert('Success', 'Announcement deleted');
              load();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || 'Failed to delete');
            }
          },
        },
      ],
    );
  };

  const showActions = (ann: AdminAnnouncement) => {
    Alert.alert(ann.title, 'Choose an action', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => openEdit(ann) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(ann) },
    ]);
  };

  const renderItem = ({ item }: { item: AdminAnnouncement }) => (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => showActions(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.annTitle} numberOfLines={1}>{item.title}</Text>
        <View style={[styles.badge, { backgroundColor: (item.is_active ? Brand.primary : Brand.textTertiary) + '20' }]}>
          <Text style={[styles.badgeText, { color: item.is_active ? Brand.primary : Brand.textTertiary }]}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      <Text style={styles.message} numberOfLines={3}>{item.message}</Text>
      <View style={styles.cardFooter}>
        <View style={[styles.audienceBadge]}>
          <Text style={styles.audienceText}>To: {item.target_audience}</Text>
        </View>
        <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.dark, Brand.darkLight, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Announcements</Text>
          <Pressable onPress={openCreate} hitSlop={12}>
            <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>

        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={announcements}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="bullhorn-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No announcements</Text>
                <Text style={styles.emptySub}>Create one to get started</Text>
              </View>
            }
          />
        )}

        <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editing ? 'Edit Announcement' : 'New Announcement'}</Text>
                <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Title</Text>
                <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Announcement title" placeholderTextColor={Brand.textTertiary} />
                <Text style={styles.fieldLabel}>Message</Text>
                <TextInput style={[styles.input, { minHeight: 100 }]} value={message} onChangeText={setMessage} placeholder="Announcement message" placeholderTextColor={Brand.textTertiary} multiline textAlignVertical="top" />
                <Text style={styles.fieldLabel}>Target Audience</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {AUDIENCE_OPTIONS.map((a) => (
                    <Pressable key={a} style={[styles.audienceTab, audience === a && styles.audienceTabActive]} onPress={() => setAudience(a)}>
                      <Text style={[styles.audienceTabText, audience === a && styles.audienceTabTextActive]}>{a.charAt(0).toUpperCase() + a.slice(1)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.switchRow}>
                  <Text style={styles.fieldLabel}>Active</Text>
                  <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: Brand.border, true: Brand.primary }} />
                </View>
                <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} disabled={saving} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
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
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  annTitle: { fontSize: 15, fontWeight: '800', color: Brand.text, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  message: { fontSize: 13, color: Brand.textSecondary, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  audienceBadge: { backgroundColor: Brand.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  audienceText: { fontSize: 11, fontWeight: '700', color: Brand.textSecondary },
  dateText: { fontSize: 12, color: Brand.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Brand.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, padding: 12, fontSize: 14, color: Brand.text, marginBottom: 16 },
  audienceTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Brand.surfaceAlt, borderWidth: 1, borderColor: Brand.border, marginRight: 8 },
  audienceTabActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  audienceTabText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  audienceTabTextActive: { color: '#FFFFFF' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  saveBtn: { backgroundColor: Brand.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
