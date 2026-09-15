import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { getEscrow, type EscrowHold, type EscrowResponse } from '@/services/seller';

const STATUS_COLORS: Record<string, string> = {
  held: Brand.rating,
  released: Brand.primary,
  refunded: Brand.danger,
  disputed: Brand.danger,
  partially_refunded: '#F59E0B',
};

const STATUS_LABELS: Record<string, string> = {
  held: 'Funds Held',
  released: 'Released',
  refunded: 'Refunded',
  disputed: 'Disputed',
  partially_refunded: 'Partially Refunded',
};

export default function SellerEscrowScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState<EscrowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const result = await getEscrow();
      setData(result);
    } catch (e: any) {
      setError(e?.message || 'Failed to load escrow data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: EscrowHold }) => {
    const color = STATUS_COLORS[item.status] || colors.textTertiary;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderNumber}>#{item.order_number}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{STATUS_LABELS[item.status] || item.status}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.metricCol}>
            <Text style={styles.metricValue}>{item.currency} {Number(item.amount_held).toLocaleString()}</Text>
            <Text style={styles.metricLabel}>Amount Held</Text>
          </View>
          <View style={styles.metricCol}>
            <Text style={styles.metricValue}>{item.buyer_email}</Text>
            <Text style={styles.metricLabel}>Buyer</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <MaterialCommunityIcons name="calendar-clock" size={14} color={colors.textTertiary} />
            <Text style={styles.footerText}>Held: {new Date(item.held_at).toLocaleDateString()}</Text>
          </View>
          {item.auto_release_date && (
            <View style={styles.footerItem}>
              <MaterialCommunityIcons name="lock-clock" size={14} color={Brand.rating} />
              <Text style={styles.footerText}>Auto-release: {new Date(item.auto_release_date).toLocaleDateString()}</Text>
            </View>
          )}
        </View>
        {item.tracking_number ? (
          <View style={styles.footerItem}>
            <MaterialCommunityIcons name="barcode-scan" size={14} color={colors.textTertiary} />
            <Text style={styles.footerText}>Tracking: {item.tracking_number}</Text>
          </View>
        ) : null}
        <View style={styles.confirmRow}>
          <MaterialCommunityIcons
            name={item.buyer_confirmed_receipt ? 'check-circle' : 'clock-outline'}
            size={16}
            color={item.buyer_confirmed_receipt ? Brand.primary : Brand.rating}
          />
          <Text style={[styles.confirmText, { color: item.buyer_confirmed_receipt ? Brand.primary : Brand.rating }]}>
            {item.buyer_confirmed_receipt ? 'Buyer confirmed receipt' : 'Awaiting buyer confirmation'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="Escrow & Trade Assurance" showBack />

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : data ? (
          <FlatList
            data={data.escrows}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListHeaderComponent={
              <View>
                {/* Trade assurance banner */}
                {data.trade_assurance ? (
                  <View style={styles.assuranceBanner}>
                    <MaterialCommunityIcons name="shield-check" size={28} color={Brand.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assuranceTitle}>Trade Assurance Active</Text>
                      <Text style={styles.assuranceSub}>Your buyers are protected. Funds held in escrow until they confirm receipt.</Text>
                    </View>
                  </View>
                ) : null}

                {/* KPI cards */}
                <View style={styles.kpiRow}>
                  <View style={styles.kpiCard}>
                    <View style={[styles.kpiIcon, { backgroundColor: Brand.rating + '20' }]}>
                      <MaterialCommunityIcons name="lock" size={20} color={Brand.rating} />
                    </View>
                    <Text style={styles.kpiValue}>UGX {Number(data.total_held).toLocaleString()}</Text>
                    <Text style={styles.kpiLabel}>Held</Text>
                  </View>
                  <View style={styles.kpiCard}>
                    <View style={[styles.kpiIcon, { backgroundColor: Brand.primary + '20' }]}>
                      <MaterialCommunityIcons name="check-circle" size={20} color={Brand.primary} />
                    </View>
                    <Text style={styles.kpiValue}>UGX {Number(data.total_released).toLocaleString()}</Text>
                    <Text style={styles.kpiLabel}>Released</Text>
                  </View>
                  <View style={styles.kpiCard}>
                    <View style={[styles.kpiIcon, { backgroundColor: '#3B82F620' }]}>
                      <MaterialCommunityIcons name="swap-horizontal" size={20} color="#3B82F6" />
                    </View>
                    <Text style={styles.kpiValue}>{data.total_count}</Text>
                    <Text style={styles.kpiLabel}>Total Escrows</Text>
                  </View>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="lock-outline" size={48} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No escrow transactions</Text>
                <Text style={styles.emptySub}>Cross-border B2B escrows will appear here</Text>
              </View>
            }
          />
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  listContent: { padding: 14, paddingBottom: 20 },

  // Assurance banner
  assuranceBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Brand.primary + '10', borderWidth: 1, borderColor: Brand.primary + '30',
    borderRadius: 14, padding: 16, marginBottom: 14,
  },
  assuranceTitle: { fontSize: 15, fontWeight: '800', color: Brand.primary },
  assuranceSub: { fontSize: 12, color: c.textSecondary, marginTop: 4, lineHeight: 18 },

  // KPI row
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  kpiCard: {
    flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 14,
    alignItems: 'center', gap: 6, elevation: 2, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  kpiIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  kpiValue: { fontSize: 14, fontWeight: '800', color: c.text },
  kpiLabel: { fontSize: 10, color: c.textTertiary, fontWeight: '600' },

  // Card
  card: {
    backgroundColor: c.surface, borderRadius: 14, padding: 16,
    marginBottom: 10, elevation: 2, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderNumber: { fontSize: 15, fontWeight: '800', color: c.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardBody: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.borderLight },
  metricCol: { flex: 1 },
  metricValue: { fontSize: 13, fontWeight: '700', color: c.text },
  metricLabel: { fontSize: 10, color: c.textTertiary, marginTop: 2 },

  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { fontSize: 12, color: c.textSecondary },

  confirmRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.borderLight,
  },
  confirmText: { fontSize: 13, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: c.textSecondary },
  emptySub: { fontSize: 13, color: c.textTertiary },
});
