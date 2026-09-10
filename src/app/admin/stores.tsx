import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import {
  getAdminStores,
  storeAction,
  type AdminStore,
} from '@/services/adminApi';

const STATUS_COLORS: Record<string, string> = {
  approved: Brand.primary,
  pending: Brand.rating,
  suspended: Brand.danger,
  rejected: Brand.textTertiary,
};

const VERIFICATION_COLORS: Record<string, string> = {
  verified: Brand.primary,
  pending: Brand.rating,
  rejected: Brand.danger,
  unverified: Brand.textTertiary,
};

const FILTERS = ['all', 'pending', 'approved', 'suspended', 'rejected'] as const;

export default function AdminStoresScreen() {
  const router = useRouter();
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async (status?: string) => {
    try {
      setRefreshing(true);
      const data = await getAdminStores(status && status !== 'all' ? { status } : undefined);
      setStores(data);
    } catch (e: any) {
      console.error('Admin stores error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(filter); }, [load, filter]);

  const handleAction = (store: AdminStore, action: string, label: string) => {
    Alert.alert(
      `Confirm ${label}`,
      `Are you sure you want to ${label.toLowerCase()} "${store.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              await storeAction(store.id, action);
              Alert.alert('Success', `${label} successful`);
              load(filter);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || 'Action failed');
            }
          },
        },
      ],
    );
  };

  const showActions = (store: AdminStore) => {
    const buttons: any[] = [{ text: 'Cancel', style: 'cancel' }];
    if (store.status !== 'approved') buttons.push({ text: 'Approve', onPress: () => handleAction(store, 'approve', 'Approve') });
    if (store.status !== 'rejected') buttons.push({ text: 'Reject', style: 'destructive', onPress: () => handleAction(store, 'reject', 'Reject') });
    if (store.status !== 'suspended') buttons.push({ text: 'Suspend', style: 'destructive', onPress: () => handleAction(store, 'suspend', 'Suspend') });
    Alert.alert(`Actions for ${store.name}`, 'Choose an action', buttons);
  };

  const renderItem = ({ item }: { item: AdminStore }) => {
    const color = STATUS_COLORS[item.status] || Brand.textTertiary;
    const vColor = VERIFICATION_COLORS[item.verification_status] || Brand.textTertiary;
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => showActions(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.storeName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.ownerEmail}>{item.owner_email}</Text>
        <View style={styles.cardFooter}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={[styles.badge, { backgroundColor: vColor + '20' }]}>
              <Text style={[styles.badgeText, { color: vColor }]}>{item.verification_status}</Text>
            </View>
            <Text style={styles.metaText}>{item.prod_count} products</Text>
          </View>
          {item.is_featured && (
            <MaterialCommunityIcons name="star" size={16} color={Brand.rating} />
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="Stores" />
      <View style={styles.body}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={stores}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(filter)} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="store-off-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No stores found</Text>
                <Text style={styles.emptySub}>No stores match this filter</Text>
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
  filterContainer: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Brand.border },
  filterTabActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  filterTextActive: { color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  storeName: { fontSize: 15, fontWeight: '800', color: Brand.text, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  ownerEmail: { fontSize: 13, color: Brand.textSecondary, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
});
