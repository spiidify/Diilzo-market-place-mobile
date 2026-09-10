import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import {
  getAdminDisputes,
  processRefund,
  type AdminDispute,
} from '@/services/adminApi';

const STATUS_COLORS: Record<string, string> = {
  open: Brand.rating,
  under_review: '#3B82F6',
  resolved: Brand.primary,
  refunded: Brand.accent,
  closed: Brand.textTertiary,
};

const FILTERS = ['all', 'open', 'under_review', 'resolved', 'refunded'] as const;

export default function AdminDisputesScreen() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async (status?: string) => {
    try {
      setRefreshing(true);
      const data = await getAdminDisputes(status && status !== 'all' ? status : undefined);
      setDisputes(data);
    } catch (e: any) {
      console.error('Admin disputes error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(filter); }, [load, filter]);

  const handleRefund = (dispute: AdminDispute) => {
    Alert.alert(
      'Process Refund',
      `Refund UGX ${Number(dispute.refund_amount).toLocaleString()} for dispute on order #${dispute.order_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refund',
          style: 'destructive',
          onPress: async () => {
            try {
              await processRefund(dispute.id);
              Alert.alert('Success', 'Refund processed successfully');
              load(filter);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || 'Failed to process refund');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: AdminDispute }) => {
    const color = STATUS_COLORS[item.status] || Brand.textTertiary;
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => item.status === 'open' && handleRefund(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.storeName} numberOfLines={1}>{item.store_name}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status.replace('_', ' ')}</Text>
          </View>
        </View>
        <Text style={styles.orderNumber}>Order #{item.order_number}</Text>
        <Text style={styles.reason}>{item.reason}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
          {item.refund_amount !== '0' && (
            <Text style={styles.refundAmount}>Refund: UGX {Number(item.refund_amount).toLocaleString()}</Text>
          )}
        </View>
        {item.status === 'open' && (
          <View style={styles.actionHint}>
            <MaterialCommunityIcons name="gesture-tap" size={14} color={Brand.primary} />
            <Text style={styles.actionHintText}>Tap to process refund</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.dark, Brand.darkLight, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Disputes</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'All' : f.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={disputes}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(filter)} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="shield-check-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No disputes found</Text>
                <Text style={styles.emptySub}>All clear!</Text>
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
  orderNumber: { fontSize: 13, color: Brand.textSecondary, marginBottom: 4 },
  reason: { fontSize: 14, fontWeight: '700', color: Brand.text, marginBottom: 4 },
  description: { fontSize: 13, color: Brand.textSecondary, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 12, color: Brand.textTertiary },
  refundAmount: { fontSize: 12, fontWeight: '700', color: Brand.danger },
  actionHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  actionHintText: { fontSize: 12, fontWeight: '600', color: Brand.primary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
});
