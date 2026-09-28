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
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { apiRequest } from '@/services/api';
import type { ClaimableCoupon } from '@/types';

interface CouponsResponse {
  results: ClaimableCoupon[];
}

/**
 * Copy text to the clipboard using expo-clipboard (SDK 57).
 * `setStringAsync` works across Android, iOS, and web, returning a boolean
 * indicating whether the string was saved.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  return Clipboard.setStringAsync(text);
}

export default function BuyerCouponsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [coupons, setCoupons] = useState<ClaimableCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await apiRequest<CouponsResponse>({ method: 'GET', url: '/coupons/claimable/' });
      setCoupons(Array.isArray(data) ? data : data.results || []);
    } catch (e: any) {
      console.error('Buyer coupons error:', e?.message);
      setError(e?.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCopy = async (code: string) => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1800);
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
    const meta = [
      `Min UGX ${Number(item.min_order_amount).toLocaleString()}`,
      item.store_name || 'All stores',
      item.valid_to ? `till ${new Date(item.valid_to).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : null,
    ].filter(Boolean).join(' · ');
    return (
      <View style={styles.row}>
        <View style={[styles.ticketIcon, expired && { backgroundColor: colors.textTertiary + '15' }]}>
          <MaterialCommunityIcons name="ticket-percent" size={20} color={expired ? colors.textTertiary : Brand.primary} />
        </View>
        <View style={styles.info}>
          <View style={styles.topRow}>
            <Text style={[styles.discountValue, expired && { color: colors.textTertiary }]}>{formatDiscount(item)}</Text>
            <Text style={[styles.codeText, expired && { color: colors.textTertiary }]}>{item.code}</Text>
          </View>
          <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
        </View>
        {expired ? (
          <Text style={styles.expiredText}>Expired</Text>
        ) : (
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
            {copied && <Text style={styles.copyBtnTextDone}>Copied</Text>}
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="My Coupons"
        subtitle={!loading && coupons.length > 0 ? `${coupons.length} coupon${coupons.length === 1 ? '' : 's'}` : undefined}
      />
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
      ) : coupons.length === 0 ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="ticket-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.title}>No coupons available</Text>
          <Text style={styles.subtitle}>
            Check back later for new discounts and vouchers from your favourite stores.
          </Text>
          <Pressable style={({ pressed }) => [styles.shopBtn, pressed && { opacity: 0.85 }]} onPress={() => router.push('/')}>
            <Text style={styles.shopBtnText}>Browse Products</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={coupons}
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
  },
  copyBtnDone: { backgroundColor: Brand.primary + '14', borderWidth: 1, borderColor: Brand.primary },
  copyBtnTextDone: { color: Brand.primary, fontWeight: '800', fontSize: 11 },
  rowDivider: { height: 1, backgroundColor: c.borderLight, marginLeft: 56 },
});
