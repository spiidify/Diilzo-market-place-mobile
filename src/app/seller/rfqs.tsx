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
import { getRFQs, type SellerRFQ } from '@/services/seller';

export default function SellerRFQsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const STATUS_COLORS: Record<string, string> = {
    pending: Brand.rating,
    quoted: '#3B82F6',
    accepted: Brand.primary,
    rejected: Brand.danger,
    expired: colors.textTertiary,
  };
  const [rfqs, setRfqs] = useState<SellerRFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const data = await getRFQs();
      setRfqs(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: SellerRFQ }) => {
    const color = STATUS_COLORS[item.status] || colors.textTertiary;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        onPress={() => router.push(`/seller/rfqs/${item.id}` as any)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.productName} numberOfLines={1}>{item.product_name}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.metricCol}>
            <Text style={styles.metricValue}>{item.quantity}</Text>
            <Text style={styles.metricLabel}>Qty</Text>
          </View>
          {item.target_price && (
            <View style={styles.metricCol}>
              <Text style={styles.metricValue}>UGX {Number(item.target_price).toLocaleString()}</Text>
              <Text style={styles.metricLabel}>Target</Text>
            </View>
          )}
          {item.quoted_price && (
            <View style={styles.metricCol}>
              <Text style={styles.metricValue}>UGX {Number(item.quoted_price).toLocaleString()}</Text>
              <Text style={styles.metricLabel}>Quoted</Text>
            </View>
          )}
        </View>
        <Text style={styles.buyerText}>{item.buyer_email}</Text>
        <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="RFQs" />

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
            data={rfqs}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="file-document-outline" size={48} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No RFQs</Text>
                <Text style={styles.emptySub}>Buyer quotes will appear here</Text>
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
  productName: { fontSize: 15, fontWeight: '800', color: c.text, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardBody: { flexDirection: 'row', gap: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.borderLight },
  metricCol: { flex: 1 },
  metricValue: { fontSize: 13, fontWeight: '700', color: c.text },
  metricLabel: { fontSize: 10, color: c.textTertiary, marginTop: 2 },
  buyerText: { fontSize: 12, color: c.textSecondary, marginTop: 4 },
  dateText: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: c.textSecondary },
  emptySub: { fontSize: 13, color: c.textTertiary },
});
