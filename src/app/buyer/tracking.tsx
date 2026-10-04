import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Easing,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { GradientHeader } from '@/components/GradientHeader';
import { Brand, Spacing } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { fetchOrderTracking } from '@/services/orders';

interface TrackingData {
  order_id: number;
  order_status: string;
  shipments: Array<{
    id: number;
    carrier: string;
    tracking_number: string;
    status: string;
    store_name?: string;
    origin_lat?: number | null;
    origin_lng?: number | null;
    destination_address?: Record<string, string>;
    shipped_at: string | null;
    delivered_at: string | null;
    estimated_delivery: string | null;
  }>;
}

/** OpenStreetMap embed HTML centered on the shipment origin. */
function osmMapHtml(lat: number, lng: number): string {
  const bbox = `${lng - 0.02},${lat - 0.012},${lng + 0.02},${lat + 0.012}`;
  return `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>html,body,iframe{margin:0;padding:0;height:100%;width:100%;border:0;}</style>
    </head><body>
    <iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}"></iframe>
    </body></html>`;
}

// Journey steps — keys map to backend order statuses
const STEPS = [
  { key: 'pending', label: 'Placed', icon: 'clipboard-check-outline' as const },
  { key: 'processing', label: 'Preparing', icon: 'package-variant' as const },
  { key: 'shipped', label: 'On the Way', icon: 'truck-fast-outline' as const },
  { key: 'delivered', label: 'Delivered', icon: 'package-variant-closed-check' as const },
];

// Map backend statuses onto the 4-step journey
function stepIndexFor(status: string): number {
  switch (status) {
    case 'delivered': return 3;
    case 'shipped': return 2;
    case 'processing':
    case 'confirmed': return 1;
    default: return 0;
  }
}

const STATUS_HEADLINE: Record<number, { title: string; icon: string; sub: string }> = {
  0: { title: 'Order received', icon: 'clipboard-check-outline', sub: 'The seller has your order and will start preparing it.' },
  1: { title: 'Preparing your package', icon: 'package-variant', sub: 'Your items are being packed and handed to the carrier.' },
  2: { title: 'On the way', icon: 'truck-fast-outline', sub: 'Your package is moving toward your delivery address.' },
  3: { title: 'Delivered', icon: 'check-decagram-outline', sub: 'Package delivered. Enjoy your purchase!' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Animated horizontal journey stepper with a travelling truck + pulsing current step. */
function JourneyStepper({ currentStep, colors }: { currentStep: number; colors: ThemeColors }) {
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: currentStep / (STEPS.length - 1),
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [currentStep, progress]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const stepSpacing = Math.max(0, (trackWidth - 38) / (STEPS.length - 1));
  const truckX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, trackWidth - 38)] });
  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [19, Math.max(19, trackWidth - 19)] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const cancelled = currentStep < 0;

  return (
    <View>
      {/* Truck travelling along the progress track */}
      {!cancelled && trackWidth > 0 && (
        <Animated.View style={[stepperStyles.truck, { transform: [{ translateX: truckX }] }]}>
          <View style={stepperStyles.truckBubble}>
            <MaterialCommunityIcons name="truck-fast" size={15} color="#FFFFFF" />
          </View>
          <View style={stepperStyles.truckTail} />
        </Animated.View>
      )}

      {/* Track line + steps */}
      <View
        style={stepperStyles.track}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <View style={stepperStyles.trackBg} />
        {!cancelled && (
          <Animated.View style={[stepperStyles.trackFill, { width: fillWidth }]} />
        )}
        {STEPS.map((step, i) => {
          const done = i <= currentStep;
          const isCurrent = i === currentStep && !cancelled;
          const isFirst = i === 0;
          const isLast = i === STEPS.length - 1;
          return (
            <View
              key={step.key}
              style={[stepperStyles.stepWrap, { left: i * stepSpacing }]}
            >
              {isCurrent && (
                <Animated.View
                  style={[
                    stepperStyles.pulseRing,
                    { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
                  ]}
                />
              )}
              <View
                style={[
                  stepperStyles.stepDot,
                  done && stepperStyles.stepDotDone,
                  isCurrent && stepperStyles.stepDotCurrent,
                ]}
              >
                <MaterialCommunityIcons
                  name={step.icon}
                  size={15}
                  color={done ? '#FFFFFF' : colors.textTertiary}
                />
              </View>
              <Text
                style={[
                  stepperStyles.stepLabel,
                  isFirst && stepperStyles.stepLabelFirst,
                  isLast && stepperStyles.stepLabelLast,
                  done ? { color: colors.text, fontWeight: '700' } : { color: colors.textTertiary },
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  truck: { position: 'absolute', top: 0, left: 0, zIndex: 2, alignItems: 'center' },
  truckBubble: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  truckTail: {
    width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: Brand.primary, marginTop: -2,
  },
  track: { flexDirection: 'row', height: 34, marginTop: 46 },
  trackBg: {
    position: 'absolute', left: 0, right: 0, top: 15, height: 4,
    borderRadius: 2, backgroundColor: '#E5E9F0',
  },
  trackFill: {
    position: 'absolute', left: 0, top: 15, height: 4,
    borderRadius: 2, backgroundColor: Brand.primary,
  },
  stepWrap: { position: 'absolute', top: -2, width: 38, alignItems: 'center' },
  pulseRing: {
    position: 'absolute', top: 0,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Brand.primary,
  },
  stepDot: {
    width: 34, height: 34, borderRadius: 17, marginTop: 2,
    backgroundColor: '#EEF1F5', borderWidth: 2, borderColor: '#E5E9F0',
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  stepDotCurrent: { borderColor: '#FFFFFF', elevation: 4, shadowColor: Brand.primary, shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  stepLabel: { fontSize: 9.5, marginTop: 6, textAlign: 'center', width: 70, marginLeft: -16 },
  stepLabelFirst: { textAlign: 'left', marginLeft: 0, width: 50 },
  stepLabelLast: { textAlign: 'right', marginLeft: 0, marginRight: -4, width: 50, alignSelf: 'flex-end' },
});

export default function OrderTrackingScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const cancelled = tracking?.order_status === 'cancelled' || tracking?.order_status === 'refunded';
  const currentStep = tracking ? (cancelled ? -1 : stepIndexFor(tracking.order_status)) : 0;
  const headline = STATUS_HEADLINE[Math.max(0, currentStep)];
  const eta = tracking?.shipments.find((s) => s.estimated_delivery)?.estimated_delivery;

  if (loading) {
    return (
      <View style={styles.screen}>
        <GradientHeader title="Track Order" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (error || !tracking) {
    return (
      <View style={styles.screen}>
        <GradientHeader title="Track Order" />
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="map-marker-off-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>{error || 'No tracking information available'}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <GradientHeader title="Track Order" subtitle={`Order #${orderId}`} />

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
        {/* Journey hero — animated stepper */}
        <View style={styles.heroCard}>
          {cancelled ? (
            <View style={styles.cancelledRow}>
              <MaterialCommunityIcons name="close-circle-outline" size={26} color={Brand.danger} />
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>Order {tracking.order_status}</Text>
                <Text style={styles.heroSub}>This order is no longer on the way.</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.heroTop}>
                <View style={styles.heroIconWrap}>
                  <MaterialCommunityIcons name={headline.icon as any} size={22} color={Brand.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>{headline.title}</Text>
                  <Text style={styles.heroSub}>{headline.sub}</Text>
                </View>
              </View>
              <JourneyStepper currentStep={currentStep} colors={colors} />
              <View style={styles.heroEtaRow}>
                <MaterialCommunityIcons name="calendar-clock-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.heroEta}>
                  {eta ? `Estimated delivery: ${formatDate(eta)}` : 'Delivery estimate will appear once shipped'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Dispatch map */}
        {(() => {
          const withCoords = tracking.shipments.filter(
            (s) => s.origin_lat != null && s.origin_lng != null
          );
          if (withCoords.length === 0) return null;
          const first = withCoords[0];
          const dest = first.destination_address || {};
          return (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="map-outline" size={20} color={Brand.primary} />
                <Text style={styles.sectionTitle}>Delivery Route</Text>
              </View>
              <View style={styles.mapCard}>
                <WebView
                  source={{ html: osmMapHtml(first.origin_lat!, first.origin_lng!) }}
                  style={styles.map}
                  scrollEnabled={false}
                />
                <View style={styles.mapLegend}>
                  <View style={styles.mapLegendRow}>
                    <MaterialCommunityIcons name="store-marker" size={15} color={Brand.primary} />
                    <Text style={styles.mapLegendText} numberOfLines={1}>
                      From: {first.store_name || 'Seller dispatch point'}
                    </Text>
                  </View>
                  {(dest.city || dest.country) && (
                    <View style={styles.mapLegendRow}>
                      <MaterialCommunityIcons name="map-marker" size={15} color={Brand.danger} />
                      <Text style={styles.mapLegendText} numberOfLines={1}>
                        To: {[dest.city, dest.country].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })()}

        {/* Shipment cards */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="truck-fast-outline" size={20} color={Brand.primary} />
            <Text style={styles.sectionTitle}>Shipments ({tracking.shipments.length})</Text>
          </View>

          {tracking.shipments.length === 0 ? (
            <View style={styles.card}>
              <View style={styles.emptyShipment}>
                <MaterialCommunityIcons name="package-variant-closed" size={36} color={colors.textTertiary} />
                <Text style={styles.emptyShipmentText}>
                  No shipments yet. Your order is being prepared.
                </Text>
              </View>
            </View>
          ) : (
            tracking.shipments.map((ship) => (
              <View key={`ship-${ship.id}`} style={styles.card}>
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

                <View style={styles.shipmentRow}>
                  <MaterialCommunityIcons name="barcode" size={18} color={colors.textTertiary} />
                  <Text style={styles.shipmentRowLabel}>Tracking #</Text>
                  <Text style={styles.shipmentRowValue}>{ship.tracking_number || 'N/A'}</Text>
                </View>
                <View style={styles.shipmentRow}>
                  <MaterialCommunityIcons name="calendar-export" size={18} color={colors.textTertiary} />
                  <Text style={styles.shipmentRowLabel}>Shipped</Text>
                  <Text style={styles.shipmentRowValue}>{formatDate(ship.shipped_at)}</Text>
                </View>
                <View style={styles.shipmentRow}>
                  <MaterialCommunityIcons name="calendar-clock-outline" size={18} color={colors.textTertiary} />
                  <Text style={styles.shipmentRowLabel}>Est. Delivery</Text>
                  <Text style={styles.shipmentRowValue}>{formatDate(ship.estimated_delivery)}</Text>
                </View>
                <View style={styles.shipmentRow}>
                  <MaterialCommunityIcons name="package-check" size={18} color={colors.textTertiary} />
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
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.four },
  emptyText: { marginTop: Spacing.three, fontSize: 15, color: c.textSecondary, textAlign: 'center' },
  retryBtn: {
    marginTop: Spacing.three,
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: 10,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  body: { flex: 1, backgroundColor: c.background },
  bodyContent: { padding: 12, paddingBottom: Spacing.six },

  // Journey hero
  heroCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1, borderColor: c.borderLight,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIconWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Brand.primary + '15', alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 16, fontWeight: '800', color: c.text },
  heroSub: { fontSize: 12, color: c.textSecondary, marginTop: 2, lineHeight: 17 },
  heroEtaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 44, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.borderLight,
  },
  heroEta: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
  cancelledRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Sections
  section: { marginBottom: Spacing.three },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text },

  // Cards
  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    borderWidth: 1,
    borderColor: c.borderLight,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  emptyShipment: { alignItems: 'center', paddingVertical: Spacing.three, gap: Spacing.two },
  emptyShipmentText: { fontSize: 14, color: c.textSecondary, textAlign: 'center' },

  mapCard: {
    backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: c.borderLight,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, marginBottom: Spacing.two,
  },
  map: { height: 200, backgroundColor: c.surfaceAlt },
  mapLegend: { padding: Spacing.two, gap: 4 },
  mapLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapLegendText: { fontSize: 12, color: c.textSecondary, flex: 1 },

  shipmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  shipmentCarrier: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  shipmentCarrierName: { fontSize: 15, fontWeight: '700', color: c.text },
  shipmentStatusBadge: { paddingHorizontal: Spacing.two + 2, paddingVertical: Spacing.one + 2, borderRadius: 8 },
  shipmentStatusText: { fontSize: 12, fontWeight: '700' },

  shipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 6,
  },
  shipmentRowLabel: { fontSize: 13, color: c.textSecondary, flex: 1 },
  shipmentRowValue: { fontSize: 14, fontWeight: '600', color: c.text },
});
