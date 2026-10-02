import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
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
import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { claimCoupon, fetchClaimableCoupons, fetchMyCoupons } from '@/services/catalog';
import type { ClaimableCoupon } from '@/types';

type Tab = 'mine' | 'available';

export default function BuyerCouponsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>('available');
  const [mine, setMine] = useState<ClaimableCoupon[]>([]);
  const [available, setAvailable] = useState<ClaimableCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [claimingCode, setClaimingCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const [claimable, claimed] = await Promise.all([
        fetchClaimableCoupons(),
        isAuthenticated ? fetchMyCoupons().catch(() => [] as ClaimableCoupon[]) : Promise.resolve([] as ClaimableCoupon[]),
      ]);
      setAvailable(claimable);
      setMine(claimed);
      if (claimed.length > 0) setTab('mine');
    } catch (e: any) {
      console.error('Buyer coupons error:', e?.message);
      setError(e?.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  const handleCopy = async (code: string) => {
    const ok = await Clipboard.setStringAsync(code);
    if (ok) {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1800);
    }
  };

  const handleClaim = async (code: string) => {
    if (!isAuthenticated) {
      await handleCopy(code);
      return;
    }
    setClaimingCode(code);
    try {
      const claimed = await claimCoupon(code);
      await Clipboard.setStringAsync(code).catch(() => false);
      setMine((prev) => [claimed, ...prev.filter((c) => c.code !== code)]);
      setAvailable((prev) => prev.map((c) => (c.code === code ? { ...c, claimed: true } : c)));
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1800);
    } catch {
      // server rejected — still leave the code usable via copy
      await handleCopy(code);
    } finally {
      setClaimingCode(null);
    }
  };

  const formatDiscount = (c: ClaimableCoupon) => {
    const value = Number(c.discount_value);
    if (c.discount_type === 'percentage') return `${value}% OFF`;
    return `UGX ${value.toLocaleString()} OFF`;
  };

  const renderItem = ({ item }: { item: ClaimableCoupon }) => {
    const copied = copiedCode === item.code;
    const expired = item.valid_to ? new Date(item.valid_to).getTime() < Date.now() : false;
    const used = tab === 'mine' && !!item.used;
    const claimed = tab === 'mine' || !!item.claimed;
    const inactive = expired || used;
    const meta = [
      `Min UGX ${Number(item.min_order_amount).toLocaleString()}`,
      item.store_name || 'All stores',
      item.valid_to ? `till ${new Date(item.valid_to).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : null,
    ].filter(Boolean).join(' · ');
    return (
      <View style={styles.row}>
        <View style={[styles.ticketIcon, inactive && { backgroundColor: colors.textTertiary + '15' }]}>
          <MaterialCommunityIcons name="ticket-percent" size={20} color={inactive ? colors.textTertiary : Brand.primary} />
        </View>
        <View style={styles.info}>
          <View style={styles.topRow}>
            <Text style={[styles.discountValue, inactive && { color: colors.textTertiary }]}>{formatDiscount(item)}</Text>
            <Text style={[styles.codeText, inactive && { color: colors.textTertiary }]}>{item.code}</Text>
          </View>
          <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
        </View>
        {used ? (
          <Text style={styles.expiredText}>Used</Text>
        ) : expired ? (
          <Text style={styles.expiredText}>Expired</Text>
        ) : tab === 'mine' || claimed ? (
          <Pressable
            style={({ pressed }) => [styles.copyBtn, copied && styles.copyBtnDone, pressed && { opacity: 0.8 }]}
            onPress={() => handleCopy(item.code)}
            hitSlop={6}
          >
            <MaterialCommunityIcons
              name={copied ? 'check' : 'content-copy'}
              size={14}
              color={copied ? Brand.primary : '#FFFFFF'}
            />
            {copied ? <Text style={styles.copyBtnTextDone}>Copied</Text> : <Text style={styles.claimBtnText}>Copy</Text>}
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.8 }]}
            onPress={() => handleClaim(item.code)}
            disabled={claimingCode === item.code}
            hitSlop={6}
          >
            {claimingCode === item.code ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.claimBtnText}>Claim</Text>
            )}
          </Pressable>
        )}
      </View>
    );
  };

  const listData = tab === 'mine' ? mine : available;
  const emptyTitle = tab === 'mine' ? 'No vouchers yet' : 'No coupons available';
  const emptySub = tab === 'mine'
    ? 'Vouchers you grab will appear here so you can use them at checkout.'
    : 'Check back later for new discounts and vouchers from your favourite stores.';

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="My Coupons"
        subtitle={!loading && listData.length > 0 ? `${listData.length} coupon${listData.length === 1 ? '' : 's'}` : undefined}
      />
      {isAuthenticated && (
        <View style={styles.tabs}>
          {(['mine', 'available'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'mine' ? 'My Vouchers' : 'Available'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {loading ? (
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={44} color={Brand.danger} />
          <Text style={styles.errorTitle}>Couldn't load coupons</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <Pressable style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]} onPress={load}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : listData.length === 0 ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="ticket-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.title}>{emptyTitle}</Text>
          <Text style={styles.subtitle}>{emptySub}</Text>
          <Pressable style={({ pressed }) => [styles.shopBtn, pressed && { opacity: 0.85 }]} onPress={() => router.push('/')}>
            <Text style={styles.shopBtnText}>Browse Products</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, index) => `${item.code}-${index}`}
          renderItem={renderItem}
          style={styles.listCard}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
          maxToRenderPerBatch={12}
          windowSize={11}
          initialNumToRender={12}
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
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  title: { marginTop: 12, fontSize: 16, fontWeight: '700', color: c.text },
  subtitle: { marginTop: 6, fontSize: 13, color: c.textSecondary, textAlign: 'center' },
  shopBtn: { marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 10 },
  shopBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  errorTitle: { marginTop: 10, fontSize: 15, fontWeight: '700', color: Brand.danger },
  errorSub: { marginTop: 3, fontSize: 13, color: c.textTertiary, textAlign: 'center' },
  retryBtn: { marginTop: 14, backgroundColor: Brand.primary, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  tabs: { flexDirection: 'row', gap: 8, margin: 10, marginBottom: 0 },
  tabBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  tabBtnActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: c.textSecondary },
  tabTextActive: { color: '#FFFFFF' },

  listCard: { flex: 1 },
  list: {
    margin: 10, borderRadius: 14, overflow: 'hidden',
    backgroundColor: c.surface,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 10, paddingVertical: 9,
  },
  ticketIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Brand.primary + '14',
    justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1, gap: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  discountValue: { fontSize: 13, fontWeight: '800', color: c.text },
  codeText: {
    fontSize: 11, fontWeight: '800', color: Brand.primary, letterSpacing: 0.8,
    backgroundColor: Brand.primary + '12', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
  },
  meta: { fontSize: 11, color: c.textTertiary, fontWeight: '500' },
  expiredText: { fontSize: 10, fontWeight: '700', color: c.textTertiary, textTransform: 'uppercase' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Brand.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    minWidth: 58, justifyContent: 'center',
  },
  copyBtnDone: { backgroundColor: Brand.primary + '14', borderWidth: 1, borderColor: Brand.primary },
  copyBtnTextDone: { color: Brand.primary, fontWeight: '800', fontSize: 11 },
  claimBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  rowDivider: { height: 1, backgroundColor: c.borderLight, marginLeft: 56 },
});
