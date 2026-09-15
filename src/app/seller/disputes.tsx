import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import {
  getDisputes,
  type SellerDispute,
} from '@/services/seller';

export default function SellerDisputesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const STATUS_COLORS: Record<string, string> = {
    open: Brand.rating,
    under_review: '#3B82F6',
    resolved: Brand.primary,
    closed: colors.textTertiary,
    escalated: Brand.danger,
  };
  const [disputes, setDisputes] = useState<SellerDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const data = await getDisputes();
      setDisputes(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: SellerDispute }) => {
    const color = STATUS_COLORS[item.status] || colors.textTertiary;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        onPress={() => router.push(`/seller/disputes/${item.id}` as any)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.orderNumber}>#{item.order_number}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.reason}>{item.reason}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
          {item.refund_amount !== '0' && (
            <Text style={styles.refundAmount}>Refund: UGX {Number(item.refund_amount).toLocaleString()}</Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="Disputes" />

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : error ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={disputes}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="check-circle-outline" size={48} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No disputes</Text>
                <Text style={styles.emptySub}>All clear!</Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  listContent: { padding: 12 },
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderNumber: { fontSize: 15, fontWeight: '800', color: c.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  reason: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 4 },
  description: { fontSize: 13, color: c.textSecondary, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 12, color: c.textTertiary },
  refundAmount: { fontSize: 12, fontWeight: '700', color: Brand.danger },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: c.textSecondary },
  emptySub: { fontSize: 13, color: c.textTertiary },
});
