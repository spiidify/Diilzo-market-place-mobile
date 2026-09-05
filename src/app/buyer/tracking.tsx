import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import { fetchOrderTracking } from '@/services/orders';

interface TrackingData {
  order_id: number;
  order_status: string;
  shipments: Array<{
    id: number;
    carrier: string;
    tracking_number: string;
    status: string;
    shipped_at: string | null;
    delivered_at: string | null;
    estimated_delivery: string | null;
  }>;
}

// Timeline steps in order
const TIMELINE_STEPS = [
  { key: 'pending', label: 'Order Placed', icon: 'clipboard-check-outline' as const },
  { key: 'confirmed', label: 'Confirmed', icon: 'check-circle-outline' as const },
  { key: 'shipped', label: 'Shipped', icon: 'truck-fast-outline' as const },
  { key: 'delivered', label: 'Delivered', icon: 'package-variant-closed-check' as const },
];

function getStepIndex(status: string): number {
  const idx = TIMELINE_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function OrderTrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ order_id: string }>();
  const orderId = Number(params.order_id);

  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      setRefreshing(true);
      setError(null);
      const data = await fetchOrderTracking(orderId);
      setTracking(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load tracking info');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const currentStep = tracking ? getStepIndex(tracking.order_status) : 0;

  if (loading) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <LinearGradient
            colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Track Order</Text>
            <View style={{ width: 24 }} />
          </LinearGradient>
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !tracking) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <LinearGradient
            colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Track Order</Text>
            <View style={{ width: 24 }} />
          </LinearGradient>
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="map-marker-off-outline" size={48} color={Brand.textTertiary} />
            <Text style={styles.emptyText}>{error || 'No tracking information available'}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient
          colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Track Order</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={load}
              colors={[Brand.primary]}
              tintColor={Brand.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Status timeline */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="timeline-clock-outline" size={20} color={Brand.primary} />
              <Text style={styles.sectionTitle}>Order Status</Text>
            </View>
            <View style={styles.timelineCard}>
              {TIMELINE_STEPS.map((step, index) => {
                const isCompleted = index <= currentStep;
                const isCurrent = index === currentStep;
                const isLast = index === TIMELINE_STEPS.length - 1;
                return (
                  <View key={`step-${step.key}`} style={styles.timelineRow}>
                    {/* Icon + line column */}
                    <View style={styles.timelineIconCol}>
                      <View
                        style={[
                          styles.timelineIconWrap,
                          isCompleted && styles.timelineIconCompleted,
                          isCurrent && styles.timelineIconCurrent,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={isCompleted ? step.icon : 'circle-outline'}
                          size={20}
                          color={isCompleted ? '#FFFFFF' : Brand.textTertiary}
                        />
                      </View>
                      {!isLast && (
                        <View
                          style={[
                            styles.timelineLine,
                            index < currentStep && styles.timelineLineCompleted,
                          ]}
                        />
                      )}
                    </View>
                    {/* Label column */}
                    <View style={styles.timelineLabelCol}>
                      <Text
                        style={[
                          styles.timelineLabel,
                          isCompleted ? styles.timelineLabelActive : styles.timelineLabelInactive,
                        ]}
                      >
                        {step.label}
                      </Text>
                      {isCurrent && (
                        <Text style={styles.timelineCurrentText}>Current status</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Shipment cards */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="truck-fast-outline" size={20} color={Brand.primary} />
              <Text style={styles.sectionTitle}>Shipments ({tracking.shipments.length})</Text>
            </View>

            {tracking.shipments.length === 0 ? (
              <View style={styles.card}>
                <View style={styles.emptyShipment}>
                  <MaterialCommunityIcons name="package-variant-closed" size={36} color={Brand.textTertiary} />
                  <Text style={styles.emptyShipmentText}>
                    No shipments yet. Your order is being prepared.
                  </Text>
                </View>
              </View>
            ) : (
              tracking.shipments.map((ship) => (
                <View key={`ship-${ship.id}`} style={styles.card}>
                  {/* Shipment header */}
                  <View style={styles.shipmentHeader}>
                    <View style={styles.shipmentCarrier}>
                      <MaterialCommunityIcons name="truck-outline" size={22} color={Brand.primary} />
                      <Text style={styles.shipmentCarrierName}>{ship.carrier}</Text>
                    </View>
                    <View
                      style={[
                        styles.shipmentStatusBadge,
                        { backgroundColor: (ship.status === 'delivered' ? Brand.success : Brand.rating) + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.shipmentStatusText,
                          { color: ship.status === 'delivered' ? Brand.success : Brand.rating },
                        ]}
                      >
                        {ship.status.charAt(0).toUpperCase() + ship.status.slice(1)}
                      </Text>
                    </View>
                  </View>

                  {/* Tracking number */}
                  <View style={styles.shipmentRow}>
                    <MaterialCommunityIcons name="barcode" size={18} color={Brand.textTertiary} />
                    <Text style={styles.shipmentRowLabel}>Tracking #</Text>
                    <Text style={styles.shipmentRowValue}>{ship.tracking_number || 'N/A'}</Text>
                  </View>

                  {/* Shipped date */}
                  <View style={styles.shipmentRow}>
                    <MaterialCommunityIcons name="calendar-export" size={18} color={Brand.textTertiary} />
                    <Text style={styles.shipmentRowLabel}>Shipped</Text>
                    <Text style={styles.shipmentRowValue}>{formatDate(ship.shipped_at)}</Text>
                  </View>

                  {/* Estimated delivery */}
                  <View style={styles.shipmentRow}>
                    <MaterialCommunityIcons name="calendar-clock-outline" size={18} color={Brand.textTertiary} />
                    <Text style={styles.shipmentRowLabel}>Est. Delivery</Text>
                    <Text style={styles.shipmentRowValue}>{formatDate(ship.estimated_delivery)}</Text>
                  </View>

                  {/* Delivered date */}
                  <View style={styles.shipmentRow}>
                    <MaterialCommunityIcons name="package-check" size={18} color={Brand.textTertiary} />
                    <Text style={styles.shipmentRowLabel}>Delivered</Text>
                    <Text
                      style={[
                        styles.shipmentRowValue,
                        ship.delivered_at && { color: Brand.success, fontWeight: '700' },
                      ]}
                    >
                      {formatDate(ship.delivered_at)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.four },
  emptyText: { marginTop: Spacing.three, fontSize: 15, color: Brand.textSecondary, textAlign: 'center' },
  retryBtn: {
    marginTop: Spacing.three,
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: 10,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.three, paddingBottom: Spacing.six },

  // Sections
  section: { marginBottom: Spacing.three },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.text },

  // Timeline
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: Spacing.three,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  timelineRow: { flexDirection: 'row', minHeight: 56 },
  timelineIconCol: { alignItems: 'center', marginRight: Spacing.three },
  timelineIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineIconCompleted: { backgroundColor: Brand.primary },
  timelineIconCurrent: {
    backgroundColor: Brand.primary,
    borderWidth: 3,
    borderColor: Brand.surfaceAlt,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Brand.border,
    marginTop: 4,
    marginBottom: 4,
  },
  timelineLineCompleted: { backgroundColor: Brand.primary },
  timelineLabelCol: { flex: 1, justifyContent: 'center', paddingBottom: Spacing.three },
  timelineLabel: { fontSize: 15, fontWeight: '600' },
  timelineLabelActive: { color: Brand.text },
  timelineLabelInactive: { color: Brand.textTertiary },
  timelineCurrentText: { fontSize: 12, color: Brand.primary, fontWeight: '600', marginTop: 2 },

  // Shipment cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  emptyShipment: { alignItems: 'center', paddingVertical: Spacing.three, gap: Spacing.two },
  emptyShipmentText: { fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },

  shipmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Brand.borderLight,
  },
  shipmentCarrier: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  shipmentCarrierName: { fontSize: 15, fontWeight: '700', color: Brand.text },
  shipmentStatusBadge: { paddingHorizontal: Spacing.two + 2, paddingVertical: Spacing.one + 2, borderRadius: 8 },
  shipmentStatusText: { fontSize: 12, fontWeight: '700' },

  shipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 6,
  },
  shipmentRowLabel: { fontSize: 13, color: Brand.textSecondary, flex: 1 },
  shipmentRowValue: { fontSize: 14, fontWeight: '600', color: Brand.text },
});
