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
import { getShipments, type SellerShipment } from '@/services/seller';

export default function SellerShipmentsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const STATUS_COLORS: Record<string, string> = {
    pending: Brand.rating,
    picked_up: '#3B82F6',
    in_transit: '#8B5CF6',
    out_for_delivery: '#06B6D4',
    delivered: Brand.primary,
    failed: Brand.danger,
    cancelled: colors.textTertiary,
  };
  const [shipments, setShipments] = useState<SellerShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const data = await getShipments();
      setShipments(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: SellerShipment }) => {
    const color = STATUS_COLORS[item.status] || colors.textTertiary;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        onPress={() => router.push(`/seller/shipments/${item.id}` as any)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.orderNumber}>#{item.order_number}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.metricCol}>
            <Text style={styles.metricValue}>{item.carrier}</Text>
            <Text style={styles.metricLabel}>Carrier</Text>
          </View>
          <View style={styles.metricCol}>
            <Text style={styles.metricValue} numberOfLines={1}>{item.tracking_number || '—'}</Text>
            <Text style={styles.metricLabel}>Tracking</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <MaterialCommunityIcons name="truck-fast-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.footerText}>{item.shipping_method}</Text>
          <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="Shipments" />

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
            data={shipments}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="package-variant-closed" size={48} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No shipments</Text>
                <Text style={styles.emptySub}>Shipments will appear here</Text>
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
  cardBody: { flexDirection: 'row', gap: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.borderLight },
  metricCol: { flex: 1 },
  metricValue: { fontSize: 13, fontWeight: '700', color: c.text },
  metricLabel: { fontSize: 10, color: c.textTertiary, marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  footerText: { fontSize: 12, color: c.textSecondary, flex: 1 },
  dateText: { fontSize: 12, color: c.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: c.textSecondary },
  emptySub: { fontSize: 13, color: c.textTertiary },
});
