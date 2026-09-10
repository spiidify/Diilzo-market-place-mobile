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
  getAdminPayouts,
  processPayout,
  type AdminPayout,
} from '@/services/adminApi';

const STATUS_COLORS: Record<string, string> = {
  pending: Brand.rating,
  processing: '#3B82F6',
  completed: Brand.primary,
  failed: Brand.danger,
};

const FILTERS = ['all', 'pending', 'processing', 'completed', 'failed'] as const;

export default function AdminPayoutsScreen() {
  const router = useRouter();
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async (status?: string) => {
    try {
      setRefreshing(true);
      const data = await getAdminPayouts(status && status !== 'all' ? status : undefined);
      setPayouts(data);
    } catch (e: any) {
      console.error('Admin payouts error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(filter); }, [load, filter]);

  const handleProcess = (payout: AdminPayout) => {
    Alert.alert(
      'Process Payout',
      `Enter a reference for the payout to ${payout.store_name} (UGX ${Number(payout.amount).toLocaleString()})`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process',
          onPress: async () => {
            try {
              await processPayout(payout.id, payout.reference || `PAYOUT-${payout.id}`);
              Alert.alert('Success', 'Payout processed successfully');
              load(filter);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || 'Failed to process payout');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: AdminPayout }) => {
    const color = STATUS_COLORS[item.status] || Brand.textTertiary;
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => item.status === 'pending' && handleProcess(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.storeName} numberOfLines={1}>{item.store_name}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.amount}>UGX {Number(item.amount).toLocaleString()}</Text>
        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.metaLabel}>Method</Text>
            <Text style={styles.metaValue}>{item.method}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.metaLabel}>Destination</Text>
            <Text style={styles.metaValue} numberOfLines={1}>{item.destination}</Text>
          </View>
        </View>
        <Text style={styles.dateText}>{new Date(item.created_at).toLocaleString()}</Text>
        {item.status === 'pending' && (
          <View style={styles.actionHint}>
            <MaterialCommunityIcons name="gesture-tap" size={14} color={Brand.primary} />
            <Text style={styles.actionHintText}>Tap to process</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="Payouts" />
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
            data={payouts}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(filter)} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="cash-off" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No payouts found</Text>
                <Text style={styles.emptySub}>No payouts match this filter</Text>
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
  amount: { fontSize: 18, fontWeight: '900', color: Brand.text, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', marginBottom: 4 },
  metaLabel: { fontSize: 11, fontWeight: '700', color: Brand.textTertiary, textTransform: 'uppercase', marginBottom: 2 },
  metaValue: { fontSize: 13, color: Brand.text },
  dateText: { fontSize: 12, color: Brand.textTertiary, marginTop: 4 },
  actionHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  actionHintText: { fontSize: 12, fontWeight: '600', color: Brand.primary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
});
