import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { GradientHeader } from '@/components/GradientHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { fetchLoyalty, fetchWallet, type LoyaltyInfo, type Wallet } from '@/services/orders';

const fmtMoney = (v: string | number, currency = 'UGX') =>
  `${currency} ${Number(v || 0).toLocaleString()}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const TX_ICONS: Record<string, { icon: string; color: string }> = {
  refund: { icon: 'cash-refund', color: '#06B6D4' },
  promo: { icon: 'tag-heart-outline', color: '#EC4899' },
  reward: { icon: 'gift-outline', color: '#F59E0B' },
  purchase: { icon: 'cart-outline', color: '#EF4444' },
  adjustment: { icon: 'swap-horizontal', color: '#8B5CF6' },
};

export default function WalletScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const [w, l] = await Promise.allSettled([fetchWallet(), fetchLoyalty()]);
      if (w.status === 'fulfilled') setWallet(w.value);
      if (l.status === 'fulfilled') setLoyalty(l.value);
      if (w.status === 'rejected' && l.status === 'rejected') {
        setError('Could not load wallet. Pull to retry.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => {
    const txs = (wallet?.transactions || []).map((t) => ({
      key: `w${t.id}`, icon: TX_ICONS[t.tx_type] || TX_ICONS.adjustment,
      title: t.note || t.tx_type.replace('_', ' '),
      sub: t.order_number ? `Order ${t.order_number}` : fmtDate(t.created_at),
      value: `${t.is_credit ? '+' : '-'} ${fmtMoney(t.amount, wallet?.currency)}`,
      credit: t.is_credit,
      date: t.created_at,
    }));
    const pts = (loyalty?.transactions || []).map((t) => ({
      key: `l${t.id}`, icon: { icon: 'star-four-points', color: Brand.rating },
      title: t.note || (t.points > 0 ? 'Points earned' : 'Points redeemed'),
      sub: t.order_number ? `Order ${t.order_number}` : fmtDate(t.created_at),
      value: `${t.points > 0 ? '+' : ''}${t.points} pts`,
      credit: t.points > 0,
      date: t.created_at,
    }));
    return [...txs, ...pts].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [wallet, loyalty]);

  return (
    <View style={styles.root}>
      <GradientHeader title="Wallet & Rewards" subtitle="Store credit and loyalty points" />

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Brand.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.key}
          contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Brand.primary} />
          }
          ListHeaderComponent={
            <>
              {/* Balance hero */}
              <LinearGradient
                colors={[Brand.dark, Brand.accent, Brand.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <View style={styles.heroRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroLabel}>Wallet Balance</Text>
                    <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>
                      {fmtMoney(wallet?.balance || 0, wallet?.currency)}
                    </Text>
                    <Text style={styles.heroSub}>Store credit — refunds &amp; rewards land here</Text>
                  </View>
                  <View style={styles.heroIcon}>
                    <MaterialCommunityIcons name="wallet-outline" size={30} color="#FFFFFF" />
                  </View>
                </View>
              </LinearGradient>

              {/* Loyalty card */}
              {loyalty && (
                <View style={styles.loyaltyCard}>
                  <View style={styles.loyaltyIcon}>
                    <MaterialCommunityIcons name="star-four-points" size={22} color={Brand.rating} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.loyaltyTitle}>
                      {loyalty.points.toLocaleString()} pts · {loyalty.tier}
                    </Text>
                    <Text style={styles.loyaltySub}>
                      {loyalty.next_tier
                        ? `${loyalty.points_to_next.toLocaleString()} pts to ${loyalty.next_tier} · ${loyalty.earn_rate}`
                        : loyalty.earn_rate}
                    </Text>
                    {!!loyalty.next_tier && (
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${Math.min(100, Math.round((loyalty.points / (loyalty.points + loyalty.points_to_next)) * 100))}%` },
                          ]}
                        />
                      </View>
                    )}
                  </View>
                </View>
              )}

              {!!error && <Text style={styles.errorText}>{error}</Text>}
              <Text style={styles.sectionTitle}>Activity</Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="receipt-text-outline" size={44} color={colors.textTertiary} />
              <Text style={styles.emptyText}>
                No activity yet — refunds, rewards and points will show here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.txRow}>
              <View style={[styles.txIcon, { backgroundColor: item.icon.color + '15' }]}>
                <MaterialCommunityIcons name={item.icon.icon as any} size={20} color={item.icon.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.txSub}>{item.sub}</Text>
              </View>
              <Text style={[styles.txValue, { color: item.credit ? '#10B981' : '#EF4444' }]}>
                {item.value}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    hero: { margin: 12, borderRadius: 16, padding: 18 },
    heroRow: { flexDirection: 'row', alignItems: 'center' },
    heroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
    heroAmount: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
    heroSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
    heroIcon: {
      width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center', justifyContent: 'center',
    },
    loyaltyCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.surface, borderRadius: 14, padding: 14, marginHorizontal: 12,
      borderWidth: 1, borderColor: c.border,
    },
    loyaltyIcon: {
      width: 42, height: 42, borderRadius: 21, backgroundColor: Brand.rating + '18',
      alignItems: 'center', justifyContent: 'center',
    },
    loyaltyTitle: { fontSize: 15, fontWeight: '800', color: c.text },
    loyaltySub: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
    progressTrack: { height: 6, borderRadius: 3, backgroundColor: c.border, marginTop: 8, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: Brand.rating, borderRadius: 3 },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: c.text, margin: 12, marginBottom: 4 },
    txRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: c.surface, marginHorizontal: 12, marginTop: 6,
      borderRadius: 12, padding: 12,
    },
    txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    txTitle: { fontSize: 13, fontWeight: '700', color: c.text },
    txSub: { fontSize: 11, color: c.textSecondary, marginTop: 1 },
    txValue: { fontSize: 13, fontWeight: '800' },
    empty: { alignItems: 'center', padding: 30 },
    emptyText: { fontSize: 13, color: c.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 19 },
    errorText: { fontSize: 12, color: Brand.danger, marginHorizontal: 12, marginTop: 8 },
  });
}
