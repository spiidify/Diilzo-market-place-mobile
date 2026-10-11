import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import {
  createFlashDeal,
  flashDealAction,
  getFlashDeals,
  type FlashDealsPayload,
  type SellerDealProduct,
  type SellerFlashCampaign,
  type SellerFlashDeal,
} from '@/services/seller';

const DURATIONS = [
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '3 days', hours: 72 },
];

function stateChip(s: SellerFlashDeal['state_label']): { text: string; color: string } {
  switch (s) {
    case 'live': return { text: 'Live', color: '#16A34A' };
    case 'scheduled': return { text: 'Scheduled', color: '#D97706' };
    case 'sold_out': return { text: 'Sold Out', color: '#0284C7' };
    case 'paused': return { text: 'Paused', color: '#D97706' };
    case 'pulled': return { text: 'Pulled by Admin', color: '#DC2626' };
    case 'ended': return { text: 'Ended', color: '#64748B' };
    default: return { text: 'Withdrawn', color: '#64748B' };
  }
}

export default function SellerFlashDealsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [payload, setPayload] = useState<FlashDealsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // create-form state
  const [product, setProduct] = useState<SellerDealProduct | null>(null);
  const [campaign, setCampaign] = useState<SellerFlashCampaign | null>(null);
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [hours, setHours] = useState(12);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getFlashDeals();
      setPayload(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load flash deals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const minPrice = product ? Number(product.min_deal_price) : 0;
  const dealPrice = Number(price);
  const discPct = product && dealPrice > 0
    ? Math.round((Number(product.price) - dealPrice) / Number(product.price) * 100)
    : 0;

  const handleCreate = async () => {
    if (!product) { Alert.alert('Pick a product'); return; }
    if (!dealPrice || dealPrice <= 0) { Alert.alert('Enter a deal price'); return; }
    if (dealPrice > minPrice) {
      Alert.alert('Price too high', `Deal price must be ${minPrice.toLocaleString()} ${product.currency} or lower (min ${payload?.min_discount_pct}% off).`);
      return;
    }
    const stockN = parseInt(stock, 10);
    if (!stockN || stockN < 1 || stockN > product.stock) {
      Alert.alert('Deal stock must be 1–' + product.stock);
      return;
    }
    const now = new Date();
    const end = campaign
      ? new Date(campaign.ends_at)
      : new Date(now.getTime() + hours * 3600_000);
    setCreating(true);
    try {
      await createFlashDeal({
        product_id: product.id,
        deal_price: dealPrice,
        deal_stock: stockN,
        starts_at: campaign ? campaign.starts_at : now.toISOString(),
        ends_at: end.toISOString(),
        campaign_id: campaign?.id,
      });
      setShowModal(false);
      setProduct(null); setCampaign(null); setPrice(''); setStock('10'); setHours(12);
      Alert.alert('Deal created', 'It is live on the Flash Sale shelf.');
      load();
    } catch (e: any) {
      Alert.alert('Could not create deal', e?.message || 'Try again.');
    } finally {
      setCreating(false);
    }
  };

  const act = (d: SellerFlashDeal, action: 'pause' | 'resume' | 'withdraw') => {
    const labels = { pause: 'Pause', resume: 'Resume', withdraw: 'Withdraw' };
    Alert.alert(`${labels[action]} deal?`, d.product_name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: labels[action],
        style: action === 'withdraw' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await flashDealAction(d.id, action);
            load();
          } catch (e: any) {
            Alert.alert('Failed', e?.message || 'Try again.');
          }
        },
      },
    ]);
  };

  const renderDeal = ({ item: d }: { item: SellerFlashDeal }) => {
    const chip = stateChip(d.state_label);
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          {d.product_image ? (
            <Image source={{ uri: d.product_image }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <MaterialCommunityIcons name="image-outline" size={18} color={colors.textTertiary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{d.product_name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.dealPrice}>{d.currency} {Number(d.deal_price).toLocaleString()}</Text>
              <Text style={styles.regPrice}>{Number(d.regular_price).toLocaleString()}</Text>
              <Text style={styles.disc}>-{d.discount_pct}%</Text>
            </View>
            {d.campaign && (
              <Text style={styles.campName} numberOfLines={1}>
                <MaterialCommunityIcons name="calendar-star" size={10} color={Brand.primary} /> {d.campaign.name}
              </Text>
            )}
          </View>
          <View style={[styles.chip, { backgroundColor: chip.color + '1A' }]}>
            <Text style={[styles.chipText, { color: chip.color }]}>{chip.text}</Text>
          </View>
        </View>

        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.min(d.claimed_pct, 100)}%` }]} />
        </View>
        <Text style={styles.claimed}>
          {d.claimed_qty}/{d.deal_stock} claimed · you earn ~{d.currency} {Number(d.seller_net_per_unit).toLocaleString()}/unit
        </Text>
        <Text style={styles.window}>
          {new Date(d.starts_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          {' → '}
          {new Date(d.ends_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </Text>

        {(d.status === 'active' || d.status === 'paused') && (
          <View style={styles.actions}>
            {d.status === 'active' ? (
              <Pressable style={styles.actionBtn} onPress={() => act(d, 'pause')}>
                <MaterialCommunityIcons name="pause" size={14} color={colors.textSecondary} />
                <Text style={styles.actionText}>Pause</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.actionBtn} onPress={() => act(d, 'resume')}>
                <MaterialCommunityIcons name="play" size={14} color="#16A34A" />
                <Text style={[styles.actionText, { color: '#16A34A' }]}>Resume</Text>
              </Pressable>
            )}
            <Pressable style={styles.actionBtn} onPress={() => act(d, 'withdraw')}>
              <MaterialCommunityIcons name="delete-outline" size={14} color="#DC2626" />
              <Text style={[styles.actionText, { color: '#DC2626' }]}>Withdraw</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="Flash Deals" showBack onBack={() => router.back()} />
      <FlatList
        data={payload?.deals || []}
        keyExtractor={(d) => String(d.id)}
        renderItem={renderDeal}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="flash" size={18} color={Brand.primary} />
            <Text style={styles.infoText}>
              Limited-time prices on your products — min 10% off, capped stock, auto-expire.
              Your listing price is never changed.
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={Brand.primary} />
          ) : (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="flash-outline" size={40} color={colors.textTertiary} />
              <Text style={styles.emptyText}>{error || 'No deals yet — create one to join the Flash Sale shelf.'}</Text>
            </View>
          )
        }
      />

      {(payload?.eligible_products?.length ?? 0) > 0 && (
        <Pressable style={styles.fab} onPress={() => setShowModal(true)}>
          <MaterialCommunityIcons name="plus" size={22} color="#fff" />
          <Text style={styles.fabText}>New Deal</Text>
        </Pressable>
      )}

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>New Flash Deal</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Product</Text>
              {(payload?.eligible_products || []).map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.pickRow, product?.id === p.id && styles.pickRowOn]}
                  onPress={() => setProduct(p)}
                >
                  {p.image_url ? (
                    <Image source={{ uri: p.image_url }} style={styles.pickThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.pickThumb, styles.thumbEmpty]}>
                      <MaterialCommunityIcons name="image-outline" size={16} color={colors.textTertiary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.pickSub}>{p.currency} {Number(p.price).toLocaleString()} · stock {p.stock}</Text>
                  </View>
                  {product?.id === p.id && <MaterialCommunityIcons name="check-circle" size={18} color={Brand.primary} />}
                </Pressable>
              ))}

              {(payload?.campaigns?.length ?? 0) > 0 && (
                <>
                  <Text style={styles.label}>Campaign (optional)</Text>
                  <View style={styles.chipRow}>
                    <Pressable
                      style={[styles.optChip, !campaign && styles.optChipOn]}
                      onPress={() => setCampaign(null)}
                    >
                      <Text style={[styles.optChipText, !campaign && styles.optChipTextOn]}>Today's Deals</Text>
                    </Pressable>
                    {payload!.campaigns.map((c) => (
                      <Pressable
                        key={c.id}
                        style={[styles.optChip, campaign?.id === c.id && styles.optChipOn]}
                        onPress={() => setCampaign(c)}
                      >
                        <Text style={[styles.optChipText, campaign?.id === c.id && styles.optChipTextOn]} numberOfLines={1}>{c.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Deal Price ({product?.currency || 'UGX'})</Text>
                  <TextInput
                    style={styles.input}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="numeric"
                    placeholder={product ? `max ${minPrice.toLocaleString()}` : ''}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Deal Stock</Text>
                  <TextInput
                    style={styles.input}
                    value={stock}
                    onChangeText={setStock}
                    keyboardType="numeric"
                    placeholder={product ? `max ${product.stock}` : ''}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              </View>

              {!campaign && (
                <>
                  <Text style={styles.label}>Duration</Text>
                  <View style={styles.chipRow}>
                    {DURATIONS.map((d) => (
                      <Pressable
                        key={d.hours}
                        style={[styles.optChip, hours === d.hours && styles.optChipOn]}
                        onPress={() => setHours(d.hours)}
                      >
                        <Text style={[styles.optChipText, hours === d.hours && styles.optChipTextOn]}>{d.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {product && dealPrice > 0 && (
                <View style={styles.preview}>
                  <Text style={styles.previewText}>
                    <Text style={{ color: '#DC2626', fontWeight: '800' }}>-{discPct}% </Text>
                    · buyer pays {product.currency} {dealPrice.toLocaleString()}
                  </Text>
                </View>
              )}
            </ScrollView>
            <Pressable
              style={[styles.submit, creating && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <MaterialCommunityIcons name="flash" size={18} color="#fff" />
                  <Text style={styles.submitText}>Create Deal</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: 14, paddingBottom: 100 },
  infoCard: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: Brand.primary + '0D', borderRadius: 10,
    padding: 12, marginBottom: 12,
  },
  infoText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  card: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 12,
    marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.background },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13, fontWeight: '700', color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  dealPrice: { fontSize: 14, fontWeight: '800', color: Brand.primary },
  regPrice: { fontSize: 11, color: colors.textTertiary, textDecorationLine: 'line-through' },
  disc: { fontSize: 11, fontWeight: '800', color: '#DC2626' },
  campName: { fontSize: 10.5, color: Brand.primary, marginTop: 2 },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 10, fontWeight: '700' },
  barTrack: { height: 5, borderRadius: 3, backgroundColor: '#FDE8E8', marginTop: 10, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#EF4444', borderRadius: 3 },
  claimed: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  window: { fontSize: 10.5, color: colors.textTertiary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: colors.background,
  },
  actionText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  empty: { alignItems: 'center', marginTop: 60, gap: 8, paddingHorizontal: 30 },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  fab: {
    position: 'absolute', right: 16, bottom: 24,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Brand.primary, borderRadius: 999,
    paddingHorizontal: 18, paddingVertical: 12,
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, paddingBottom: 28,
  },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  label: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: 12, marginBottom: 6 },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 6,
  },
  pickRowOn: { borderColor: Brand.primary, backgroundColor: Brand.primary + '0D' },
  pickThumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  pickName: { fontSize: 13, fontWeight: '600', color: colors.text },
  pickSub: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  row2: { flexDirection: 'row', gap: 10 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text,
    backgroundColor: colors.background,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  optChipOn: { borderColor: Brand.primary, backgroundColor: Brand.primary + '14' },
  optChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  optChipTextOn: { color: Brand.primary },
  preview: {
    backgroundColor: Brand.primary + '0D', borderRadius: 8,
    padding: 10, marginTop: 14,
  },
  previewText: { fontSize: 12.5, color: colors.textSecondary },
  submit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Brand.primary, borderRadius: 12, paddingVertical: 13, marginTop: 16,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
