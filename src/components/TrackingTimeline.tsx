// ── TrackingTimeline — Visual chronological shipment timeline ──────
//
// Renders a vertical timeline of shipment milestones (checkpoints)
// fetched from /api/v1/orders/<id>/track-shipment/. Each checkpoint
// shows a status dot, connecting line, message, location, and timestamp.
//
// Usage:
//   <TrackingTimeline orderId={123} />

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Brand } from '@/constants/theme';
import {
  fetchShipmentTracking,
  type GlobalShipment,
  type ShipmentMilestone,
} from '@/services/logistics';

// ── Tag → icon + color mapping ─────────────────────────────────────
// AfterShip uses standard tags: Info, InTransit, OutForDelivery,
// Delivered, AttemptFail, Exception, Pending. We map each to an
// icon and color for the timeline dot.
const TAG_CONFIG: Record<string, { icon: string; color: string }> = {
  delivered: { icon: 'check-circle', color: Brand.success || '#16a34a' },
  out_for_delivery: { icon: 'truck-fast', color: '#3B82F6' },
  in_transit: { icon: 'truck', color: '#06B6D4' },
  info: { icon: 'information', color: Brand.rating || '#F59E0B' },
  attempt_fail: { icon: 'alert-circle', color: Brand.danger || '#EF4444' },
  exception: { icon: 'alert', color: Brand.danger || '#EF4444' },
  pending: { icon: 'clock-outline', color: Brand.textTertiary || '#9CA3AF' },
};

function getTagConfig(tag: string) {
  const key = (tag || '').toLowerCase().replace(/-/g, '_');
  return TAG_CONFIG[key] || { icon: 'circle-medium', color: Brand.textTertiary || '#9CA3AF' };
}

// ── Format a checkpoint timestamp for display ──────────────────────
function formatCheckpointTime(timeStr: string): string {
  if (!timeStr) return '';
  try {
    const date = new Date(timeStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timeStr;
  }
}

// ── Format estimated delivery date ────────────────────────────────
function formatEstimatedDelivery(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

// ── Single timeline checkpoint row ─────────────────────────────────
function MilestoneRow({ item, isLast, index }: { item: ShipmentMilestone; isLast: boolean; index: number }) {
  const config = getTagConfig(item.tag);
  const isFirst = index === 0;

  return (
    <View style={styles.milestoneRow}>
      {/* Left: dot + connecting line */}
      <View style={styles.milestoneLeft}>
        {/* Connecting line above the dot (skip for the first item) */}
        {!isFirst && (
          <View style={[styles.milestoneLine, { backgroundColor: '#E5E7EB' }]} />
        )}
        <View style={[styles.milestoneDot, { backgroundColor: config.color + '20', borderColor: config.color }]}>
          <MaterialCommunityIcons name={config.icon as any} size={16} color={config.color} />
        </View>
        {/* Connecting line below the dot (skip for the last item) */}
        {!isLast && (
          <View style={[styles.milestoneLine, { backgroundColor: '#E5E7EB' }]} />
        )}
      </View>

      {/* Right: content */}
      <View style={styles.milestoneContent}>
        <Text style={styles.milestoneMessage} numberOfLines={3}>
          {item.message || item.sub_tag_message || 'Status update'}
        </Text>
        {(item.location || item.city || item.country_name) && (
          <View style={styles.milestoneLocationRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={13} color={Brand.textTertiary} />
            <Text style={styles.milestoneLocation} numberOfLines={1}>
              {[item.location, item.city, item.state, item.country_name].filter(Boolean).join(', ')}
            </Text>
          </View>
        )}
        {item.checkpoint_time && (
          <Text style={styles.milestoneTime}>
            {formatCheckpointTime(item.checkpoint_time)}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Main TrackingTimeline component ────────────────────────────────
export default function TrackingTimeline({ orderId }: { orderId: number }) {
  const [shipment, setShipment] = useState<GlobalShipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      if (loading) {
        // Initial load — don't set refreshing.
      } else {
        setRefreshing(true);
      }
      setError(null);
      const data = await fetchShipmentTracking(orderId);
      setShipment(data);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to load tracking data';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, loading]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Loading state ──────────────────────────────────────────────
  if (loading && !shipment) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Brand.primary} />
        <Text style={styles.loadingText}>Loading tracking data...</Text>
      </View>
    );
  }

  // ── Error state ─────────────────────────────────────────────────
  if (error && !shipment) {
    return (
      <View style={styles.centerContainer}>
        <MaterialCommunityIcons name="map-marker-off" size={48} color={Brand.textTertiary} />
        <Text style={styles.errorTitle}>Tracking Unavailable</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!shipment) {
    return (
      <View style={styles.centerContainer}>
        <MaterialCommunityIcons name="package-variant-closed" size={48} color={Brand.textTertiary} />
        <Text style={styles.errorTitle}>No Shipment Data</Text>
        <Text style={styles.errorSubtext}>Tracking information will appear here once your order is shipped.</Text>
      </View>
    );
  }

  const milestones = shipment.tracking_milestones || [];
  // Reverse so newest checkpoint is at the top (most recent first).
  const sortedMilestones = [...milestones].sort((a, b) => {
    const ta = a.checkpoint_time || '';
    const tb = b.checkpoint_time || '';
    return tb.localeCompare(ta);
  });

  // ── Header: tracking number + carrier + EDD ────────────────────
  const renderHeader = () => (
    <View style={styles.headerCard}>
      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerLabel}>Tracking Number</Text>
          <Text style={styles.headerValue}>{shipment.tracking_number || 'N/A'}</Text>
        </View>
        {shipment.carrier_name && (
          <View style={styles.headerInfo}>
            <Text style={styles.headerLabel}>Carrier</Text>
            <Text style={styles.headerValue}>{shipment.carrier_name}</Text>
          </View>
        )}
      </View>
      {shipment.estimated_delivery_date && (
        <View style={styles.eddBanner}>
          <MaterialCommunityIcons name="calendar-clock" size={18} color={Brand.primary} />
          <Text style={styles.eddText}>
            Estimated Delivery: {formatEstimatedDelivery(shipment.estimated_delivery_date)}
          </Text>
        </View>
      )}
      {sortedMilestones.length === 0 && (
        <View style={styles.noMilestones}>
          <MaterialCommunityIcons name="clock-outline" size={28} color={Brand.textTertiary} />
          <Text style={styles.noMilestonesText}>
            No tracking updates yet. Check back soon.
          </Text>
        </View>
      )}
    </View>
  );

  // ── Render ──────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <FlatList
        data={sortedMilestones}
        keyExtractor={(item, index) => `${item.checkpoint_time}-${item.message}-${index}`}
        renderItem={({ item, index }) => (
          <MilestoneRow
            item={item}
            isLast={index === sortedMilestones.length - 1}
            index={index}
          />
        )}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={10}
        windowSize={11}
        initialNumToRender={10}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={load}
            colors={[Brand.primary]}
            tintColor={Brand.primary}
          />
        }
      />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.surfaceAlt || '#F7F8F9',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: Brand.surfaceAlt || '#F7F8F9',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Brand.textSecondary || '#666',
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: Brand.text || '#1a1a1a',
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: Brand.textSecondary || '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: Brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  // Header card
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.textTertiary || '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text || '#1a1a1a',
  },
  eddBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: (Brand.primary || '#32C700') + '10',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  eddText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.primary || '#32C700',
  },
  noMilestones: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  noMilestonesText: {
    fontSize: 13,
    color: Brand.textTertiary || '#9CA3AF',
    textAlign: 'center',
  },
  // Milestone row
  milestoneRow: {
    flexDirection: 'row',
    minHeight: 72,
  },
  milestoneLeft: {
    width: 36,
    alignItems: 'center',
    flexDirection: 'column',
  },
  milestoneLine: {
    width: 2,
    flex: 1,
    minHeight: 16,
  },
  milestoneDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  milestoneContent: {
    flex: 1,
    paddingBottom: 20,
    marginLeft: 12,
  },
  milestoneMessage: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.text || '#1a1a1a',
    lineHeight: 20,
  },
  milestoneLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  milestoneLocation: {
    fontSize: 12,
    color: Brand.textSecondary || '#666',
    flex: 1,
  },
  milestoneTime: {
    fontSize: 12,
    color: Brand.textTertiary || '#9CA3AF',
    marginTop: 4,
  },
});
