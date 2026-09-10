import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import {
  getAdminUsers,
  userAction,
  type AdminUser,
} from '@/services/adminApi';

export default function AdminUsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q?: string) => {
    try {
      setRefreshing(true);
      const data = await getAdminUsers(q);
      setUsers(data);
    } catch (e: any) {
      console.error('Admin users error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimer) clearTimeout(searchTimer);
    const t = setTimeout(() => load(text), 400);
    setSearchTimer(t);
  };

  const handleAction = (user: AdminUser, action: string, label: string) => {
    Alert.alert(
      `Confirm ${label}`,
      `Are you sure you want to ${label.toLowerCase()} ${user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              await userAction(user.id, action);
              Alert.alert('Success', `${label} successful`);
              load(query);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || 'Action failed');
            }
          },
        },
      ],
    );
  };

  const showActions = (user: AdminUser) => {
    Alert.alert(
      `Actions for ${user.email}`,
      'Choose an action',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: user.is_staff ? 'Remove Staff' : 'Make Staff',
          onPress: () => handleAction(user, 'toggle_staff', user.is_staff ? 'Remove Staff' : 'Make Staff'),
        },
        {
          text: user.is_active ? 'Deactivate' : 'Activate',
          style: 'destructive',
          onPress: () => handleAction(user, 'toggle_active', user.is_active ? 'Deactivate' : 'Activate'),
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: AdminUser }) => (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => showActions(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {item.is_staff && (
            <View style={[styles.badge, { backgroundColor: Brand.accent + '20' }]}>
              <Text style={[styles.badgeText, { color: Brand.accent }]}>Staff</Text>
            </View>
          )}
          {item.is_superuser && (
            <View style={[styles.badge, { backgroundColor: Brand.danger + '20' }]}>
              <Text style={[styles.badgeText, { color: Brand.danger }]}>Super</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.fullName}>{item.full_name || '—'}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.metaText}>{item.order_count} orders</Text>
        <Text style={styles.dateText}>{new Date(item.date_joined).toLocaleDateString()}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <ModernHeader title="Users" />
      <View style={styles.body}>
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color={Brand.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users by email or name..."
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
            data={users}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(query)} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="account-search-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No users found</Text>
                <Text style={styles.emptySub}>Try a different search</Text>
              </View>
            }
          />
        )}
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
  email: { fontSize: 15, fontWeight: '800', color: Brand.text, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  fullName: { fontSize: 13, color: Brand.textSecondary, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  dateText: { fontSize: 12, color: Brand.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
});
