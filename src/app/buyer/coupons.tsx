import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
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

import { ModernHeader } from '@/components/ModernHeader';
import { Brand, Spacing } from '@/constants/theme';
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
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="ticket-percent" size={22} color={Brand.primary} />
          <Text style={styles.discountValue}>{formatDiscount(item)}</Text>
          {expired ? (
            <View style={[styles.statusBadge, { backgroundColor: Brand.danger + '20' }]}>
              <Text style={[styles.statusText, { color: Brand.danger }]}>Expired</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: Brand.primary + '20' }]}>
              <Text style={[styles.statusText, { color: Brand.primary }]}>Active</Text>
            </View>
          )}
        </View>

        <View style={styles.codeWrap}>
          <Text style={styles.codeLabel}>Code</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{item.code}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>Min Order</Text>
            <Text style={styles.detailValue}>UGX {Number(item.min_order_amount).toLocaleString()}</Text>
          </View>
          {item.store_name ? (
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>Store</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{item.store_name}</Text>
            </View>
          ) : (
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>Store</Text>
              <Text style={styles.detailValue}>All stores</Text>
            </View>
          )}
        </View>

        {item.valid_to && (
          <View style={styles.expiryRow}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={Brand.textTertiary} />
            <Text style={styles.expiryText}>
              Valid until {new Date(item.valid_to).toLocaleDateString()}
            </Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.copyBtn, copied && styles.copyBtnDone, pressed && { opacity: 0.85 }]}
          onPress={() => handleCopy(item.code)}
        >
          <MaterialCommunityIcons
            name={copied ? 'check-circle-outline' : 'content-copy'}
            size={18}
            color={copied ? Brand.primary : '#FFFFFF'}
          />
          <Text style={[styles.copyBtnText, copied && styles.copyBtnTextDone]}>
            {copied ? 'Copied!' : 'Copy Code'}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="My Coupons" subtitle="Available discounts" />

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorTitle}>Couldn't load coupons</Text>
            <Text style={styles.errorSub}>{error}</Text>
            <Pressable style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]} onPress={load}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : coupons.length === 0 ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="ticket-outline" size={56} color={Brand.textTertiary} />
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
            contentContainerStyle={styles.list}
            maxToRenderPerBatch={8}
            windowSize={9}
            initialNumToRender={8}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  title: { marginTop: 16, fontSize: 18, fontWeight: '700', color: Brand.text },
  subtitle: { marginTop: 8, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
  shopBtn: { marginTop: 20, backgroundColor: Brand.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  shopBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  errorTitle: { marginTop: 12, fontSize: 16, fontWeight: '700', color: Brand.danger },
  errorSub: { marginTop: 4, fontSize: 13, color: Brand.textTertiary, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  list: { padding: Spacing.three, gap: Spacing.two },
  card: {
    backgroundColor: Brand.surface, borderRadius: 16, padding: Spacing.three, gap: Spacing.two,
    borderWidth: 1, borderColor: Brand.borderLight,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  discountValue: { flex: 1, fontSize: 18, fontWeight: '800', color: Brand.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  codeWrap: { gap: 6 },
  codeLabel: { fontSize: 11, fontWeight: '700', color: Brand.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  codeBox: {
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: Brand.primary, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 16, backgroundColor: Brand.primary + '0D',
    alignItems: 'center',
  },
  codeText: { fontSize: 20, fontWeight: '900', color: Brand.primary, letterSpacing: 1.5 },
  detailRow: { flexDirection: 'row', gap: Spacing.two },
  detailCol: { flex: 1, gap: 2 },
  detailLabel: { fontSize: 11, fontWeight: '600', color: Brand.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  detailValue: { fontSize: 14, fontWeight: '700', color: Brand.text },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  expiryText: { fontSize: 12, color: Brand.textTertiary },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, paddingVertical: 12, borderRadius: 12, marginTop: 4,
  },
  copyBtnDone: { backgroundColor: Brand.primary + '18', borderWidth: 1.5, borderColor: Brand.primary },
  copyBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  copyBtnTextDone: { color: Brand.primary },
});
