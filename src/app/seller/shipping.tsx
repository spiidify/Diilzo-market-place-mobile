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
import { getShippingMethods, type ShippingMethod } from '@/services/seller';

export default function SellerDeliveryScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const data = await getShippingMethods();
      setMethods(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: ShippingMethod }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.nameWrap}>
          <MaterialCommunityIcons name="truck-fast" size={20} color={Brand.primary} />
          <Text style={styles.name}>{item.name}</Text>
        </View>
        <View style={[styles.platformBadge, item.platform === false && { backgroundColor: colors.borderLight }]}>
          <Text style={[styles.platformBadgeText, item.platform === false && { color: colors.textSecondary }]}>
            {item.platform === false ? 'Legacy' : 'Platform'}
          </Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.metricCol}>
          <Text style={styles.metricValue}>UGX {Number(item.cost).toLocaleString()}</Text>
          <Text style={styles.metricLabel}>Buyer Fee</Text>
        </View>
        <View style={styles.metricCol}>
          <Text style={styles.metricValue}>{item.estimated_days} days</Text>
          <Text style={styles.metricLabel}>Est. Delivery</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ModernHeader title="Delivery" />

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
            data={methods}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListHeaderComponent={
              <View style={styles.banner}>
                <MaterialCommunityIcons name="shield-check" size={22} color={Brand.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle}>Delivery is managed by Diilzo</Text>
                  <Text style={styles.bannerText}>
                    Shipping methods, rates and delivery zones are configured by the platform. Fulfil orders on time and add tracking on each shipment.
                  </Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="truck-outline" size={48} color={colors.textTertiary} />
                <Text style={styles.emptyText}>Standard delivery applies</Text>
                <Text style={styles.emptySub}>Diilzo handles delivery for your orders</Text>
              </View>
            }
            ListFooterComponent={
              <Pressable style={({ pressed }) => [styles.shipmentsLink, pressed && { opacity: 0.7 }]} onPress={() => router.push('/seller/shipments')}>
                <MaterialCommunityIcons name="package-variant-closed" size={18} color={Brand.primary} />
                <Text style={styles.shipmentsLinkText}>View Shipments</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textTertiary} />
              </Pressable>
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
  banner: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: Brand.primary + '12', borderWidth: 1, borderColor: Brand.primary + '40',
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  bannerTitle: { fontSize: 13, fontWeight: '800', color: c.text, marginBottom: 3 },
  bannerText: { fontSize: 12, color: c.textSecondary, lineHeight: 17 },
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  nameWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '800', color: c.text },
  platformBadge: { backgroundColor: Brand.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  platformBadgeText: { fontSize: 10, fontWeight: '800', color: Brand.primary, textTransform: 'uppercase' },
  cardBody: { flexDirection: 'row', gap: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.borderLight },
  metricCol: { flex: 1 },
  metricValue: { fontSize: 14, fontWeight: '700', color: c.text },
  metricLabel: { fontSize: 10, color: c.textTertiary, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: c.textSecondary },
  emptySub: { fontSize: 13, color: c.textTertiary },
  shipmentsLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.surface, borderRadius: 12, paddingVertical: 14, marginTop: 4,
  },
  shipmentsLinkText: { fontSize: 14, fontWeight: '700', color: Brand.primary },
});
