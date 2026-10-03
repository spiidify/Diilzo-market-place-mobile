import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { fetchMyRFQs, respondToRFQ, type BuyerRFQ } from '@/services/orders';

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Awaiting quote', color: '#F59E0B' },
  quoted: { label: 'Quote received', color: '#3B82F6' },
  accepted: { label: 'Accepted', color: '#10B981' },
  rejected: { label: 'Declined', color: '#EF4444' },
  expired: { label: 'Expired', color: '#6B7280' },
};

const fmtMoney = (v: string | null, currency = 'UGX') =>
  v ? `${currency} ${Number(v).toLocaleString()}` : '—';

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

export default function BuyerRFQsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rfqs, setRfqs] = useState<BuyerRFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError(null);
      setRfqs(await fetchMyRFQs());
    } catch (e: any) {
      setError(e?.message || 'Failed to load your quotation requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const respond = (rfq: BuyerRFQ, action: 'accept' | 'reject') => {
    const verb = action === 'accept' ? 'accept this quote' : 'decline this quote';
    Alert.alert(
      action === 'accept' ? 'Accept Quote' : 'Decline Quote',
      `Are you sure you want to ${verb} from ${rfq.store_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'accept' ? 'Accept' : 'Decline',
          style: action === 'accept' ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setActingId(rfq.id);
              const res = await respondToRFQ(rfq.id, action);
              setRfqs((prev) => prev.map((r) => (r.id === rfq.id ? { ...r, status: res.status } : r)));
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.detail || e?.message || 'Action failed');
            } finally {
              setActingId(null);
            }
          },
        },
      ]
    );
  };

  const renderRfq = ({ item }: { item: BuyerRFQ }) => {
    const meta = STATUS_META[item.status] || STATUS_META.pending;
    const busy = actingId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.product_name || 'Product'}
            </Text>
            <Text style={styles.storeName}>{item.store_name || 'Seller'}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: meta.color + '15' }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Quantity</Text>
          <Text style={styles.rowValue}>{item.quantity}</Text>
        </View>
        {!!item.target_price && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Target price</Text>
            <Text style={styles.rowValue}>{fmtMoney(item.target_price)}</Text>
          </View>
        )}
        {!!item.quoted_total && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Seller's quote</Text>
            <Text style={[styles.rowValue, { color: Brand.primary }]}>
              {fmtMoney(item.quoted_total)}
              {item.quoted_at ? ` · ${fmtDate(item.quoted_at)}` : ''}
            </Text>
          </View>
        )}
        {!!item.seller_notes && (
          <Text style={styles.sellerNotes}>"{item.seller_notes}"</Text>
        )}

        {item.status === 'quoted' && (
          <View style={styles.actions}>
            <Pressable
              style={[styles.actionBtn, styles.acceptBtn]}
              disabled={busy}
              onPress={() => respond(item, 'accept')}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.acceptText}>Accept Quote</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.rejectBtn]}
              disabled={busy}
              onPress={() => respond(item, 'reject')}
            >
              <Text style={styles.rejectText}>Decline</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <GradientHeader title="My RFQs" subtitle="Bulk & custom quotation requests" />

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
      ) : rfqs.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="file-document-outline" size={56} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No quotation requests</Text>
          <Text style={styles.emptySub}>
            Need a bulk price or custom order? Request a quotation from any supplier's product page.
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => router.push('/suppliers' as any)}>
            <Text style={styles.retryText}>Browse Suppliers</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rfqs}
          keyExtractor={(r) => String(r.id)}
          renderItem={renderRfq}
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
    card: {
      backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 10,
      elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    productName: { fontSize: 14, fontWeight: '800', color: c.text },
    storeName: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    statusText: { fontSize: 11, fontWeight: '700' },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    rowLabel: { fontSize: 12, color: c.textSecondary },
    rowValue: { fontSize: 12, fontWeight: '700', color: c.text },
    sellerNotes: { fontSize: 12, color: c.textSecondary, fontStyle: 'italic', marginTop: 8 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
    acceptBtn: { backgroundColor: Brand.primary },
    acceptText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
    rejectBtn: { backgroundColor: c.surface, borderWidth: 1, borderColor: '#EF4444' },
    rejectText: { fontSize: 13, fontWeight: '800', color: '#EF4444' },
    errorText: { fontSize: 14, color: c.textSecondary, marginTop: 10, textAlign: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '800', color: c.text, marginTop: 12 },
    emptySub: { fontSize: 13, color: c.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 19 },
    retryBtn: {
      marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20,
    },
    retryText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  });
}
