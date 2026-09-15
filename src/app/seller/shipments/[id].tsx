import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { getShipmentDetail, type SellerShipmentDetail } from '@/services/seller';

const STATUS_COLORS: Record<string, string> = {
  pending: Brand.rating,
  picked_up: '#3B82F6',
  in_transit: '#8B5CF6',
  out_for_delivery: '#06B6D4',
  delivered: Brand.primary,
  failed: Brand.danger,
  cancelled: '#9CA3AF',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const STATUS_ICONS: Record<string, string> = {
  pending: 'clock-outline',
  picked_up: 'package-variant-closed',
  in_transit: 'truck-fast-outline',
  out_for_delivery: 'truck-check-outline',
  delivered: 'check-circle',
  failed: 'alert-circle',
  cancelled: 'close-circle',
};

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [detail, setDetail] = useState<SellerShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setRefreshing(true);
      const data = await getShipmentDetail(Number(id));
      setDetail(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load shipment');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const statusColor = detail ? STATUS_COLORS[detail.status] || colors.textTertiary : colors.textTertiary;
  const statusIcon = detail ? STATUS_ICONS[detail.status] || 'truck-fast-outline' : 'truck-fast-outline';

  // Timeline steps
  const timelineSteps = [
    { key: 'pending', label: 'Order Placed', date: detail?.created_at },
    { key: 'picked_up', label: 'Picked Up', date: detail?.shipped_at },
    { key: 'in_transit', label: 'In Transit', date: null },
    { key: 'delivered', label: 'Delivered', date: detail?.delivered_at },
  ];
  const currentIdx = detail ? timelineSteps.findIndex((s) => s.key === detail.status) : -1;

  return (
    <View style={styles.screen}>
      <ModernHeader title="Shipment Details" showBack />

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
        ) : detail ? (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
          >
            {/* Status banner */}
            <View style={[styles.statusBanner, { backgroundColor: statusColor + '15' }]}>
              <View style={[styles.statusIcon, { backgroundColor: statusColor + '25' }]}>
                <MaterialCommunityIcons name={statusIcon as any} size={24} color={statusColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusLabel}>Status</Text>
                <Text style={[styles.statusValue, { color: statusColor }]}>
                  {STATUS_LABELS[detail.status] || detail.status.replace(/_/g, ' ')}
                </Text>
              </View>
              <Text style={styles.orderNum}>#{detail.order_number}</Text>
            </View>

            {/* Tracking timeline */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tracking Timeline</Text>
              {timelineSteps.map((step, idx) => {
                const isDone = currentIdx >= idx || idx === 0;
                const isCurrent = currentIdx === idx;
                const stepColor = isDone ? Brand.primary : colors.textTertiary;
                return (
                  <View key={step.key} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot, { backgroundColor: isDone ? stepColor : c_border(colors) }]}>
                        {isDone && <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />}
                      </View>
                      {idx < timelineSteps.length - 1 && (
                        <View style={[styles.timelineLine, { backgroundColor: isDone ? Brand.primary + '40' : c_border(colors) }]} />
                      )}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={[styles.timelineLabel, { color: isCurrent ? Brand.primary : colors.text, fontWeight: isCurrent ? '800' : '600' }]}>
                        {step.label}
                      </Text>
                      {step.date && (
                        <Text style={styles.timelineDate}>{new Date(step.date).toLocaleString()}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Shipment info */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Shipment Information</Text>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="truck-fast-outline" size={18} color={colors.textTertiary} />
                <Text style={styles.infoLabel}>Carrier</Text>
                <Text style={styles.infoValue}>{detail.carrier}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="barcode-scan" size={18} color={colors.textTertiary} />
                <Text style={styles.infoLabel}>Tracking #</Text>
                <Text style={styles.infoValue}>{detail.tracking_number || '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="package-variant-closed" size={18} color={colors.textTertiary} />
                <Text style={styles.infoLabel}>Method</Text>
                <Text style={styles.infoValue}>{detail.shipping_method}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="swap-horizontal" size={18} color={colors.textTertiary} />
                <Text style={styles.infoLabel}>Type</Text>
                <Text style={styles.infoValue}>{detail.fulfillment_type}</Text>
              </View>
            </View>

            {/* Cost & weight */}
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <MaterialCommunityIcons name="cash" size={20} color={Brand.primary} />
                <Text style={styles.metricValue}>UGX {Number(detail.shipping_cost).toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Shipping Cost</Text>
              </View>
              {detail.weight_kg && detail.weight_kg !== '0' && (
                <View style={styles.metricCard}>
                  <MaterialCommunityIcons name="weight" size={20} color="#8B5CF6" />
                  <Text style={styles.metricValue}>{detail.weight_kg} kg</Text>
                  <Text style={styles.metricLabel}>Weight</Text>
                </View>
              )}
            </View>

            {/* Dates */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Delivery Timeline</Text>
              {detail.shipped_at && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="package-variant-closed" size={18} color={Brand.primary} />
                  <Text style={styles.infoLabel}>Shipped</Text>
                  <Text style={styles.infoValue}>{new Date(detail.shipped_at).toLocaleString()}</Text>
                </View>
              )}
              {detail.estimated_delivery && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="calendar-clock" size={18} color={Brand.rating} />
                  <Text style={styles.infoLabel}>Est. Delivery</Text>
                  <Text style={styles.infoValue}>{new Date(detail.estimated_delivery).toLocaleString()}</Text>
                </View>
              )}
              {detail.delivered_at && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="check-circle" size={18} color={Brand.primary} />
                  <Text style={styles.infoLabel}>Delivered</Text>
                  <Text style={styles.infoValue}>{new Date(detail.delivered_at).toLocaleString()}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="calendar-blank-outline" size={18} color={colors.textTertiary} />
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoValue}>{new Date(detail.created_at).toLocaleString()}</Text>
              </View>
            </View>

            <View style={{ height: 30 }} />
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

// Helper to access theme border color in render
function c_border(c: ThemeColors) { return c.borderLight; }

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  body: { flex: 1 },
  bodyContent: { padding: 14, paddingBottom: 20 },

  // Status banner
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 14, marginBottom: 12,
  },
  statusIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  statusLabel: { fontSize: 11, fontWeight: '600', color: c.textTertiary, textTransform: 'uppercase' },
  statusValue: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  orderNum: { fontSize: 14, fontWeight: '700', color: c.textSecondary },

  // Card
  card: {
    backgroundColor: c.surface, borderRadius: 14, padding: 16,
    marginBottom: 12, elevation: 2, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  cardTitle: {
    fontSize: 14, fontWeight: '800', color: c.text,
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.3,
  },

  // Info row
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  infoLabel: { fontSize: 13, fontWeight: '600', color: c.textTertiary, width: 90 },
  infoValue: { flex: 1, fontSize: 14, color: c.text, fontWeight: '500' },

  // Metrics row
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  metricCard: {
    flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 16,
    alignItems: 'center', gap: 6, elevation: 2, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  metricValue: { fontSize: 16, fontWeight: '800', color: c.text },
  metricLabel: { fontSize: 12, color: c.textTertiary, fontWeight: '500' },

  // Timeline
  timelineRow: { flexDirection: 'row', gap: 12, minHeight: 50 },
  timelineLeft: { alignItems: 'center', width: 24 },
  timelineDot: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  timelineLine: { width: 2, flex: 1, marginTop: 2 },
  timelineContent: { flex: 1, paddingBottom: 16 },
  timelineLabel: { fontSize: 14 },
  timelineDate: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
});
