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
  escrowAction,
  getAdminEscrow,
  type AdminEscrow,
  type AdminEscrowList,
} from '@/services/adminApi';

const STATUS_COLORS: Record<string, string> = {
  held: Brand.rating,
  released: Brand.primary,
  disputed: Brand.danger,
  refunded: Brand.accent,
};

const FILTERS = ['all', 'held', 'released', 'disputed', 'refunded'] as const;

export default function AdminEscrowScreen() {
  const router = useRouter();
  const [escrows, setEscrows] = useState<AdminEscrow[]>([]);
  const [summary, setSummary] = useState<{ total_held: string; total_released: string; total_disputed: string }>({ total_held: '0', total_released: '0', total_disputed: '0' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async (status?: string) => {
    try {
      setRefreshing(true);
      const data: AdminEscrowList = await getAdminEscrow(status && status !== 'all' ? status : undefined);
      setEscrows(data.results);
      setSummary({ total_held: data.total_held, total_released: data.total_released, total_disputed: data.total_disputed });
    } catch (e: any) {
      console.error('Admin escrow error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(filter); }, [load, filter]);

  const handleAction = (escrow: AdminEscrow, action: string, label: string) => {
    Alert.alert(
      `Confirm ${label}`,
      `Are you sure you want to ${label.toLowerCase()} UGX ${Number(escrow.amount_held).toLocaleString()} for order #${escrow.order_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              await escrowAction(escrow.id, action);
              Alert.alert('Success', `${label} successful`);
              load(filter);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || `Failed to ${label.toLowerCase()}`);
            }
          },
        },
      ],
    );
  };

  const showActions = (escrow: AdminEscrow) => {
    Alert.alert(
      `Escrow for #${escrow.order_number}`,
      'Choose an action',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Release to Seller', onPress: () => handleAction(escrow, 'release', 'Release to Seller') },
        { text: 'Refund to Buyer', style: 'destructive', onPress: () => handleAction(escrow, 'refund', 'Refund to Buyer') },
      ],
    );
  };

  const renderItem = ({ item }: { item: AdminEscrow }) => {
    const color = STATUS_COLORS[item.status] || Brand.textTertiary;
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => item.status === 'held' && showActions(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderNumber}>#{item.order_number}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.amount}>UGX {Number(item.amount_held).toLocaleString()}</Text>
        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.metaLabel}>Held Since</Text>
            <Text style={styles.metaValue}>{item.held_at ? new Date(item.held_at).toLocaleDateString() : '—'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.metaLabel}>Auto Release</Text>
            <Text style={styles.metaValue}>{item.auto_release_date ? new Date(item.auto_release_date).toLocaleDateString() : '—'}</Text>
          </View>
        </View>
        {item.status === 'held' && (
          <View style={styles.actionHint}>
            <MaterialCommunityIcons name="gesture-tap" size={14} color={Brand.primary} />
            <Text style={styles.actionHintText}>Tap to release or refund</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="Escrow" />
      <View style={styles.body}>
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Held</Text>
            <Text style={[styles.summaryValue, { color: Brand.rating }]}>UGX {Number(summary.total_held).toLocaleString()}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Released</Text>
            <Text style={[styles.summaryValue, { color: Brand.primary }]}>UGX {Number(summary.total_released).toLocaleString()}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Disputed</Text>
            <Text style={[styles.summaryValue, { color: Brand.danger }]}>UGX {Number(summary.total_disputed).toLocaleString()}</Text>
          </View>
        </View>

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
            data={escrows}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(filter)} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="lock-open-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No escrow records</Text>
                <Text style={styles.emptySub}>No escrow match this filter</Text>
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
  summaryContainer: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: Brand.textTertiary, textTransform: 'uppercase', marginBottom: 4 },
  summaryValue: { fontSize: 14, fontWeight: '800' },
  filterContainer: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Brand.border },
  filterTabActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  filterTextActive: { color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderNumber: { fontSize: 15, fontWeight: '800', color: Brand.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  amount: { fontSize: 18, fontWeight: '900', color: Brand.text, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { fontSize: 11, fontWeight: '700', color: Brand.textTertiary, textTransform: 'uppercase', marginBottom: 2 },
  metaValue: { fontSize: 13, color: Brand.text },
  actionHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  actionHintText: { fontSize: 12, fontWeight: '600', color: Brand.primary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
});
