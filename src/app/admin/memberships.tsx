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
  assignMembership,
  getAdminMemberships,
  type AdminMembership,
  type AdminMembershipList,
} from '@/services/adminApi';

const TIER_COLORS: Record<string, string> = {
  gold: Brand.rating,
  verified: Brand.primary,
  free: Brand.textTertiary,
};

const FILTERS = ['all', 'gold', 'verified', 'free'] as const;

export default function AdminMembershipsScreen() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<AdminMembership[]>([]);
  const [summary, setSummary] = useState<{ gold_count: number; verified_count: number; free_count: number; annual_revenue: string }>({ gold_count: 0, verified_count: 0, free_count: 0, annual_revenue: '0' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async (tier?: string) => {
    try {
      setRefreshing(true);
      const data: AdminMembershipList = await getAdminMemberships(tier && tier !== 'all' ? tier : undefined);
      setMemberships(data.results);
      setSummary({ gold_count: data.gold_count, verified_count: data.verified_count, free_count: data.free_count, annual_revenue: data.annual_revenue });
    } catch (e: any) {
      console.error('Admin memberships error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(filter); }, [load, filter]);

  const handleAssign = (membership: AdminMembership) => {
    Alert.alert(
      'Assign Tier',
      `Choose a tier for ${membership.store_name}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Gold', onPress: () => doAssign(membership, 'gold') },
        { text: 'Verified', onPress: () => doAssign(membership, 'verified') },
        { text: 'Free', onPress: () => doAssign(membership, 'free') },
      ],
    );
  };

  const doAssign = async (membership: AdminMembership, tier: string) => {
    try {
      await assignMembership(membership.id, tier);
      Alert.alert('Success', `Tier set to ${tier}`);
      load(filter);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to assign tier');
    }
  };

  const renderItem = ({ item }: { item: AdminMembership }) => {
    const color = TIER_COLORS[item.tier] || Brand.textTertiary;
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => handleAssign(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.storeName} numberOfLines={1}>{item.store_name}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.tier}</Text>
          </View>
        </View>
        <Text style={styles.feeText}>UGX {Number(item.annual_fee).toLocaleString()}/year</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.metaText}>Status: {item.status}</Text>
          {item.current_period_end && (
            <Text style={styles.dateText}>Until {new Date(item.current_period_end).toLocaleDateString()}</Text>
          )}
        </View>
        <View style={styles.actionHint}>
          <MaterialCommunityIcons name="gesture-tap" size={14} color={Brand.primary} />
          <Text style={styles.actionHintText}>Tap to assign tier</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="Memberships" />
      <View style={styles.body}>
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Gold</Text>
            <Text style={[styles.summaryValue, { color: Brand.rating }]}>{summary.gold_count}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Verified</Text>
            <Text style={[styles.summaryValue, { color: Brand.primary }]}>{summary.verified_count}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Free</Text>
            <Text style={[styles.summaryValue, { color: Brand.textTertiary }]}>{summary.free_count}</Text>
          </View>
        </View>
        <View style={styles.revenueBar}>
          <Text style={styles.revenueLabel}>Annual Revenue</Text>
          <Text style={styles.revenueValue}>UGX {Number(summary.annual_revenue).toLocaleString()}</Text>
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
            data={memberships}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(filter)} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="crown-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No memberships found</Text>
                <Text style={styles.emptySub}>No memberships match this filter</Text>
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
  summaryValue: { fontSize: 18, fontWeight: '800' },
  revenueBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Brand.dark, marginHorizontal: 12, marginTop: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  revenueLabel: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  revenueValue: { fontSize: 16, fontWeight: '900', color: Brand.primary },
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
  feeText: { fontSize: 14, fontWeight: '700', color: Brand.text, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  dateText: { fontSize: 12, color: Brand.textTertiary },
  actionHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  actionHintText: { fontSize: 12, fontWeight: '600', color: Brand.primary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
});
