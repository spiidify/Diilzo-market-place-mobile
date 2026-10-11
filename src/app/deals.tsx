import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';

import { GradientHeader } from '@/components/GradientHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { fetchDealsHub } from '@/services/catalog';
import type { DealCampaign, DealsHubResponse, Product } from '@/types';

function useDealCountdown(endsAt: string | null | undefined) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!endsAt) { setRemaining(0); return; }
    const target = new Date(endsAt).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  const totalSec = Math.floor(remaining / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return remaining > 0 ? { d, h, m, s } : null;
}

function CountdownChip({ endsAt, light }: { endsAt?: string | null; light?: boolean }) {
  const cd = useDealCountdown(endsAt);
  if (!cd) return null;
  const label = cd.d > 0
    ? `${cd.d}d ${String(cd.h).padStart(2, '0')}h ${String(cd.m).padStart(2, '0')}m`
    : `${String(cd.h).padStart(2, '0')}:${String(cd.m).padStart(2, '0')}:${String(cd.s).padStart(2, '0')}`;
  return (
    <View style={[cdStyles.chip, light && cdStyles.chipLight]}>
      <MaterialCommunityIcons name="timer-outline" size={11} color={light ? '#FFFFFF' : '#DC2626'} />
      <Text style={[cdStyles.text, light && cdStyles.textLight]}>{label}</Text>
    </View>
  );
}

const cdStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FEF2F2', borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start',
  },
  chipLight: { backgroundColor: 'rgba(255,255,255,0.2)' },
  text: { color: '#DC2626', fontSize: 10, fontWeight: '800', fontVariant: ['tabular-nums'] },
  textLight: { color: '#FFFFFF' },
});

function ClaimedBar({ pct, light }: { pct: number; light?: boolean }) {
  const width = `${Math.min(Math.max(pct, 0), 100)}%` as `${number}%`;
  return (
    <View style={barStyles.wrap}>
      <View style={[barStyles.track, light && barStyles.trackLight]}>
        <View style={[barStyles.fill, { width }]} />
      </View>
      <Text style={[barStyles.text, light && barStyles.textLight]}>{pct}% claimed</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  wrap: { marginTop: 6 },
  track: { height: 5, borderRadius: 3, backgroundColor: '#FEE2E2', overflow: 'hidden' },
  trackLight: { backgroundColor: 'rgba(255,255,255,0.3)' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: '#EF4444' },
  text: { marginTop: 3, fontSize: 9, fontWeight: '700', color: '#B91C1C' },
  textLight: { color: '#FFFFFF' },
});

function DealGridCard({ item, onPress, width }: { item: Product; onPress: () => void; width: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const deal = item.flash_deal;
  return (
    <Pressable style={({ pressed }) => [styles.gridCard, { width }, pressed && { opacity: 0.9 }]} onPress={onPress}>
      <View style={styles.gridImageWrap}>
        {item.primary_image_url ? (
          <Image source={{ uri: item.primary_image_url }} style={styles.gridImage} resizeMode="contain" />
        ) : (
          <View style={styles.gridNoImage}>
            <MaterialCommunityIcons name="image-outline" size={32} color={colors.textTertiary} />
          </View>
        )}
        <View style={styles.gridOffBadge}>
          <Text style={styles.gridOffText}>-{deal?.discount_pct ?? item.discount_percentage}%</Text>
        </View>
      </View>
      <View style={styles.gridBody}>
        <Text style={styles.gridName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.gridPriceRow}>
          <Text style={styles.gridCurrency}>{item.display_currency || item.currency}</Text>
          <Text style={styles.gridPrice} numberOfLines={1} adjustsFontSizeToFit>
            {Number(item.display_price || item.final_price).toLocaleString()}
          </Text>
        </View>
        <Text style={styles.gridOrig} numberOfLines={1}>
          {item.display_currency || item.currency} {Number(item.display_original_price || item.price).toLocaleString()}
        </Text>
        {deal ? <ClaimedBar pct={deal.claimed_pct} /> : null}
        <View style={{ marginTop: 5 }}>
          <CountdownChip endsAt={deal?.ends_at ?? item.flash_sale_ends_at} />
        </View>
      </View>
    </Pressable>
  );
}

export default function DealsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const cardWidth = (width - 16 * 2 - 10) / 2;

  const [data, setData] = useState<DealsHubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchDealsHub();
      setData(res);
    } catch {
      setData({ campaigns: [], deal_of_day: null, deals: [], live_count: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const campaigns = data?.campaigns ?? [];
  const liveCampaigns = campaigns.filter((c) => c.state === 'live');
  const dod = data?.deal_of_day ?? null;

  const deals = useMemo(() => {
    const all = data?.deals ?? [];
    if (!activeCampaign) return all;
    return all.filter((p) => p.flash_deal?.campaign === activeCampaign);
  }, [data, activeCampaign]);

  const openProduct = useCallback((slug: string) => {
    router.push(`/product/${slug}` as any);
  }, [router]);

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Today's Deals"
        subtitle={data ? `${data.live_count} live deals` : undefined}
      />
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Brand.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Brand.primary]} />}
        >
          {/* ── Live campaign banners ── */}
          {liveCampaigns.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.campRail}>
              {liveCampaigns.map((c: DealCampaign) => {
                const active = activeCampaign === c.name;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setActiveCampaign(active ? null : c.name)}
                    style={({ pressed }) => [pressed && { opacity: 0.9 }]}
                  >
                    <LinearGradient
                      colors={[c.theme_color || '#7C3AED', c.theme_color || Brand.accent]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.campCard, active && styles.campCardActive]}
                    >
                      <View style={styles.campTopRow}>
                        <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FFFFFF" />
                        <CountdownChip endsAt={c.ends_at} light />
                      </View>
                      <Text style={styles.campName} numberOfLines={1}>{c.name}</Text>
                      {!!c.tagline && <Text style={styles.campTagline} numberOfLines={1}>{c.tagline}</Text>}
                      <Text style={styles.campCta}>{active ? 'Showing · tap to clear' : 'Shop this event ›'}</Text>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* ── Deal of the Day hero ── */}
          {dod && !activeCampaign && (
            <Pressable
              style={({ pressed }) => [styles.dodCard, pressed && { opacity: 0.92 }]}
              onPress={() => openProduct(dod.slug)}
            >
              {dod.primary_image_url ? (
                <Image source={{ uri: dod.primary_image_url }} style={styles.dodImage} resizeMode="cover" />
              ) : (
                <View style={[styles.dodImage, { backgroundColor: '#1F2937' }]} />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.88)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.dodBadgeRow}>
                <View style={styles.dodBadge}>
                  <MaterialCommunityIcons name="star" size={12} color="#FFFFFF" />
                  <Text style={styles.dodBadgeText}>DEAL OF THE DAY</Text>
                </View>
                <View style={styles.dodOff}>
                  <Text style={styles.dodOffText}>-{dod.flash_deal?.discount_pct ?? dod.discount_percentage}%</Text>
                </View>
              </View>
              <View style={styles.dodBottom}>
                <Text style={styles.dodName} numberOfLines={2}>{dod.name}</Text>
                <View style={styles.dodPriceRow}>
                  <Text style={styles.dodPrice}>
                    {dod.display_currency || dod.currency} {Number(dod.display_price || dod.final_price).toLocaleString()}
                  </Text>
                  <Text style={styles.dodOrig}>
                    {dod.display_currency || dod.currency} {Number(dod.display_original_price || dod.price).toLocaleString()}
                  </Text>
                </View>
                {dod.flash_deal ? <ClaimedBar pct={dod.flash_deal.claimed_pct} light /> : null}
                <View style={styles.dodFooter}>
                  <CountdownChip endsAt={dod.flash_deal?.ends_at ?? dod.flash_sale_ends_at} light />
                  <View style={styles.dodBuy}>
                    <Text style={styles.dodBuyText}>Shop Now</Text>
                    <MaterialCommunityIcons name="arrow-right" size={14} color="#FFFFFF" />
                  </View>
                </View>
              </View>
            </Pressable>
          )}

          {/* ── Deal grid ── */}
          {deals.length > 0 ? (
            <View style={styles.grid}>
              {deals.map((item) => (
                <DealGridCard key={item.id} item={item} width={cardWidth} onPress={() => openProduct(item.slug)} />
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="lightning-bolt-outline" size={44} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No deals right now</Text>
              <Text style={styles.emptySub}>New deals land every day — check back soon.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },

  campRail: { gap: 10, paddingBottom: 4, marginBottom: 12 },
  campCard: {
    width: 210, borderRadius: 16, padding: 14,
    borderWidth: 2, borderColor: 'transparent',
  },
  campCardActive: { borderColor: '#FFFFFF' },
  campTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  campName: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  campTagline: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  campCta: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '800', marginTop: 10 },

  dodCard: { borderRadius: 18, overflow: 'hidden', marginBottom: 16, minHeight: 220, backgroundColor: '#111827' },
  dodImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  dodBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  dodBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F59E0B', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  dodBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  dodOff: { backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  dodOffText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  dodBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14 },
  dodName: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  dodPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  dodPrice: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  dodOrig: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600', textDecorationLine: 'line-through' },
  dodFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  dodBuy: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Brand.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7,
  },
  dodBuyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: {
    backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  gridImageWrap: { height: 120, backgroundColor: '#FFFFFF' },
  gridImage: { width: '100%', height: '100%' },
  gridNoImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gridOffBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: '#EF4444', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
  },
  gridOffText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  gridBody: { padding: 10 },
  gridName: { fontSize: 12.5, fontWeight: '600', color: colors.text, minHeight: 32 },
  gridPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 6 },
  gridCurrency: { fontSize: 10, fontWeight: '800', color: '#16A34A' },
  gridPrice: { fontSize: 16, fontWeight: '900', color: '#16A34A' },
  gridOrig: { fontSize: 10.5, color: colors.textTertiary, textDecorationLine: 'line-through', marginTop: 1 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  emptySub: { fontSize: 12, color: colors.textTertiary },
});
