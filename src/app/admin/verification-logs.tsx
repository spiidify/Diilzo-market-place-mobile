import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import {
  getAdminVerificationLogs,
  type AdminVerificationLog,
} from '@/services/adminApi';

export default function AdminVerificationLogsScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<AdminVerificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storeId, setStoreId] = useState('');
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (sid?: number) => {
    try {
      setRefreshing(true);
      const data = await getAdminVerificationLogs(sid);
      setLogs(data);
    } catch (e: any) {
      console.error('Admin verification logs error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (text: string) => {
    setStoreId(text);
    if (searchTimer) clearTimeout(searchTimer);
    const t = setTimeout(() => {
      const sid = Number(text);
      load(sid || undefined);
    }, 400);
    setSearchTimer(t);
  };

  const renderItem = ({ item }: { item: AdminVerificationLog }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.storeName} numberOfLines={1}>{item.store_name}</Text>
        <View style={[styles.badge, { backgroundColor: Brand.accent + '20' }]}>
          <Text style={[styles.badgeText, { color: Brand.accent }]}>{item.action}</Text>
        </View>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={styles.statusOld}>{item.previous_status || '—'}</Text>
        <MaterialCommunityIcons name="arrow-right" size={14} color={Brand.textTertiary} />
        <Text style={styles.statusNew}>{item.new_status || '—'}</Text>
      </View>
      {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
      <View style={styles.cardFooter}>
        <Text style={styles.reviewedBy}>By: {item.reviewed_by}</Text>
        <Text style={styles.dateText}>{new Date(item.created_at).toLocaleString()}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.dark, Brand.darkLight, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Verification Logs</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color={Brand.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter by store ID..."
            placeholderTextColor={Brand.textTertiary}
            value={storeId}
            onChangeText={handleSearch}
            keyboardType="numeric"
            autoCorrect={false}
          />
          {storeId.length > 0 && (
            <Pressable onPress={() => { setStoreId(''); load(); }} hitSlop={12}>
              <MaterialCommunityIcons name="close-circle" size={20} color={Brand.textTertiary} />
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(storeId ? Number(storeId) : undefined)} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No verification logs</Text>
                <Text style={styles.emptySub}>No logs match the current filter</Text>
              </View>
            }
          />
        )}
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
  storeName: { fontSize: 15, fontWeight: '800', color: Brand.text, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusLabel: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  statusOld: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  statusNew: { fontSize: 13, fontWeight: '800', color: Brand.primary },
  notes: { fontSize: 13, color: Brand.textSecondary, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewedBy: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  dateText: { fontSize: 12, color: Brand.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
});
