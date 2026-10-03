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

import { GradientHeader } from '@/components/GradientHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { fetchMyEscrow, type EscrowHoldItem } from '@/services/orders';

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  held: { label: 'Held in escrow', color: '#F59E0B', icon: 'shield-lock-outline' },
  released: { label: 'Released to seller', color: '#10B981', icon: 'shield-check-outline' },
  disputed: { label: 'Frozen — disputed', color: '#EF4444', icon: 'shield-alert-outline' },
  refunded: { label: 'Refunded to you', color: '#06B6D4', icon: 'shield-refresh-outline' },
  partially_refunded: { label: 'Partially refunded', color: '#06B6D4', icon: 'shield-half-full' },
};

const fmtMoney = (v: string | number, currency: string) =>
  `${currency} ${Number(v || 0).toLocaleString()}`;

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function BuyerEscrowScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [holds, setHolds] = useState<EscrowHoldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError(null);
      setHolds(await fetchMyEscrow());
    } catch (e: any) {
      setError(e?.message || 'Failed to load trade assurance');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalHeld = useMemo(
    () => holds.filter((h) => h.status === 'held' || h.status === 'disputed')
      .reduce((sum, h) => sum + Number(h.remaining_amount || 0), 0),
    [holds]
  );
  const heldCurrency = holds[0]?.currency || 'UGX';

  const renderHold = ({ item }: { item: EscrowHoldItem }) => {
    const meta = STATUS_META[item.status] || STATUS_META.held;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => router.push(`/buyer/orders/${item.order_id}` as any)}
      >
        <View style={styles.cardTop}>
          <View style={[styles.statusIcon, { backgroundColor: meta.color + '18' }]}>
            <MaterialCommunityIcons name={meta.icon as any} size={22} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderNo}>{item.order_number}</Text>
            <View style={[styles.statusPill, { backgroundColor: meta.color + '15' }]}>
              <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
          <Text style={styles.amount}>{fmtMoney(item.remaining_amount, item.currency)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <MaterialCommunityIcons name="calendar-clock-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.metaText}>
            {item.status === 'held' || item.status === 'disputed'
              ? item.days_until_auto_release != null
                ? `Auto-releases in ${item.days_until_auto_release} day${item.days_until_auto_release === 1 ? '' : 's'} (${fmtDate(item.auto_release_date)})`
                : `Auto-release ${fmtDate(item.auto_release_date)}`
              : item.released_at
                ? `Settled ${fmtDate(item.released_at)}`
                : `Held since ${fmtDate(item.held_at)}`}
          </Text>
        </View>
        {!!item.tracking_number && (
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="truck-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.metaText}>Tracking: {item.tracking_number}</Text>
          </View>
        )}
        {item.buyer_confirmed_receipt && (
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="check-decagram-outline" size={14} color={Brand.primary} />
            <Text style={[styles.metaText, { color: Brand.primary }]}>You confirmed receipt</Text>
          </View>
        )}
        {Number(item.refunded_amount) > 0 && (
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="cash-refund" size={14} color="#06B6D4" />
            <Text style={[styles.metaText, { color: '#06B6D4' }]}>
              {fmtMoney(item.refunded_amount, item.currency)} refunded
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <GradientHeader
        title="Trade Assurance"
        subtitle="Your money is protected until you confirm delivery"
      />

      {/* Total protected banner */}
      {!loading && holds.length > 0 && (
        <View style={styles.banner}>
          <View>
            <Text style={styles.bannerLabel}>Protected balance</Text>
            <Text style={styles.bannerAmount}>{fmtMoney(totalHeld, heldCurrency)}</Text>
          </View>
          <MaterialCommunityIcons name="shield-check" size={38} color="rgba(255,255,255,0.85)" />
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : holds.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="shield-check-outline" size={56} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No escrow payments yet</Text>
          <Text style={styles.emptySub}>
            When you pay for an order, Diilzo holds your money safely and only pays the seller after you receive your items.
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => router.push('/')}>
            <Text style={styles.retryText}>Start Shopping</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={holds}
          keyExtractor={(h) => String(h.id)}
          renderItem={renderHold}
          contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Brand.primary} />
          }
        />
      )}
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    banner: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      margin: 12, marginBottom: 0, borderRadius: 14, padding: 16,
      backgroundColor: Brand.accent,
      elevation: 2, shadowColor: Brand.accent, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    bannerLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
    bannerAmount: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
    card: {
      backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 10,
      elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    statusIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    orderNo: { fontSize: 14, fontWeight: '800', color: c.text },
    statusPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4 },
    statusText: { fontSize: 11, fontWeight: '700' },
    amount: { fontSize: 15, fontWeight: '800', color: c.text },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 10 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    metaText: { fontSize: 12, color: c.textSecondary },
    errorText: { fontSize: 14, color: c.textSecondary, marginTop: 10, textAlign: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '800', color: c.text, marginTop: 12 },
    emptySub: { fontSize: 13, color: c.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 19 },
    retryBtn: {
      marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20,
    },
    retryText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  });
}
