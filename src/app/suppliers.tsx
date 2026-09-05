import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScrollToTopButton } from '@/components/scroll-to-top';
import { Brand } from '@/constants/theme';
import { fetchStoresPage } from '@/services/catalog';
import type { PaginatedResponse, Store } from '@/types';

const BUSINESS_TYPES = [
  { label: 'All', value: '' },
  { label: 'Manufacturers', value: 'manufacturer' },
  { label: 'Wholesalers', value: 'wholesaler' },
  { label: 'Distributors', value: 'distributor' },
  { label: 'Retailers', value: 'retailer' },
];

const BUSINESS_ICONS: Record<string, string> = {
  manufacturer: 'factory',
  wholesaler: 'warehouse',
  distributor: 'truck-delivery',
  trading_company: 'swap-horizontal',
  retailer: 'store',
  individual: 'account',
};

export default function SuppliersScreen() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState('');
  const [wholesalerOnly, setWholesalerOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [count, setCount] = useState(0);

  const load = useCallback(async (reset = false) => {
    const targetPage = reset ? 1 : page;
    if (reset) {
      setPage(1);
      setHasMore(true);
    }
    try {
      if (reset) setRefreshing(true);
      else setLoadingMore(true);

      const params: Record<string, any> = { page: targetPage };
      if (search) params.search = search;
      if (wholesalerOnly) params.wholesaler = 'true';

      const data: PaginatedResponse<Store> = await fetchStoresPage(params);
      let results = data.results;
      if (activeType) {
        results = results.filter((s) => s.business_type === activeType);
      }

      setStores((prev) => (reset ? results : [...prev, ...results]));
      setCount(data.count);
      setHasMore(data.next !== null);
      if (!reset) setPage(targetPage + 1);
    } catch (e: any) {
      console.error('Suppliers load error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [page, search, activeType, wholesalerOnly]);

  useEffect(() => {
    const t = setTimeout(() => load(true), 400);
    return () => clearTimeout(t);
  }, [search, activeType, wholesalerOnly]);

  useEffect(() => {
    load(true);
  }, []);

  const onRefresh = useCallback(() => load(true), [load]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || refreshing) return;
    load(false);
  }, [hasMore, loadingMore, refreshing, load]);

  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<FlatList>(null);

  const handleScroll = useCallback((event: any) => {
    setShowScrollTop(event.nativeEvent.contentOffset.y > 300);
  }, []);

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const renderStore = ({ item }: { item: Store }) => {
    const icon = BUSINESS_ICONS[item.business_type || 'individual'] || 'store';
    const iconName = icon as any;
    const isSupplier = item.is_wholesaler;
    const rating = item.rating ? parseFloat(item.rating) : 0;
    const businessLabel = item.business_type
      ? item.business_type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Store';

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
        onPress={() => router.push(`/store/${item.slug}` as any)}
      >
        {/* ── Banner ──────────────────────────────────────────────── */}
        <View style={styles.bannerWrap}>
          {item.banner_url ? (
            <Image source={{ uri: item.banner_url }} style={styles.banner} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bannerFallback}
            >
              <MaterialCommunityIcons name={isSupplier ? 'factory' : 'store'} size={36} color="rgba(255,255,255,0.4)" />
            </LinearGradient>
          )}
          {/* Badge overlay on banner */}
          <View style={styles.bannerBadges}>
            {item.verification_status === 'gold' && (
              <View style={[styles.bannerBadge, styles.badgeGold]}>
                <MaterialCommunityIcons name="crown" size={10} color="#FFFFFF" />
                <Text style={styles.bannerBadgeText}>Gold</Text>
              </View>
            )}
            {item.verification_status === 'verified' && (
              <View style={[styles.bannerBadge, styles.badgeVerified]}>
                <MaterialCommunityIcons name="check-decagram" size={10} color="#FFFFFF" />
                <Text style={styles.bannerBadgeText}>Verified</Text>
              </View>
            )}
            {isSupplier && (
              <View style={[styles.bannerBadge, styles.badgeTA]}>
                <MaterialCommunityIcons name="shield-check" size={10} color="#FFFFFF" />
                <Text style={styles.bannerBadgeText}>Trade Assurance</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Logo + identity ─────────────────────────────────────── */}
        <View style={styles.cardContent}>
          <View style={styles.logoRow}>
            <View style={styles.logoWrap}>
              {item.logo_url ? (
                <Image source={{ uri: item.logo_url }} style={styles.logo} contentFit="cover" />
              ) : (
                <View style={styles.logoFallback}>
                  <MaterialCommunityIcons name={isSupplier ? 'factory' : 'store'} size={22} color="#FFFFFF" />
                </View>
              )}
            </View>
            <View style={styles.identity}>
              <Text style={styles.storeName} numberOfLines={2}>{item.name}</Text>
              <View style={styles.typeRow}>
                <MaterialCommunityIcons name={iconName} size={13} color={Brand.primary} />
                <Text style={styles.typeText}>{businessLabel}</Text>
                <Text style={styles.dot}>•</Text>
                <MaterialCommunityIcons name="map-marker" size={13} color={Brand.textTertiary} />
                <Text style={styles.locationText}>{item.city}, {item.country}</Text>
              </View>
            </View>
          </View>

          {/* ── Tagline ────────────────────────────────────────────── */}
          {item.tagline ? (
            <Text style={styles.tagline} numberOfLines={2}>{item.tagline}</Text>
          ) : null}

          {/* ── Stats row ──────────────────────────────────────────── */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="star" size={14} color={Brand.rating} />
              <Text style={styles.statValue}>{rating.toFixed(1)}</Text>
              <Text style={styles.statSub}>({item.review_count || 0})</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="package-variant-closed" size={14} color={Brand.textSecondary} />
              <Text style={styles.statValue}>{item.product_count || 0}</Text>
              <Text style={styles.statSub}>products</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="clock-outline" size={14} color={Brand.textSecondary} />
              <Text style={styles.statSub}>Responds fast</Text>
            </View>
          </View>

          {/* ── Footer actions ─────────────────────────────────────── */}
          <View style={styles.cardFooter}>
            <Pressable
              style={({ pressed }) => [styles.contactBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/store/${item.slug}` as any)}
            >
              <MaterialCommunityIcons name="chat-outline" size={16} color={Brand.primary} />
              <Text style={styles.contactText}>Contact</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.visitBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/store/${item.slug}` as any)}
            >
              <Text style={styles.visitText}>Visit Store</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* ── Orange gradient header ──────────────────────────────── */}
        <LinearGradient
          colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Suppliers & Manufacturers</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.searchBar}>
            <MaterialCommunityIcons name="magnify" size={20} color={Brand.textTertiary} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search suppliers, products..."
              placeholderTextColor={Brand.textTertiary}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle" size={20} color={Brand.textTertiary} />
              </Pressable>
            )}
          </View>
        </LinearGradient>

        {/* ── Filter bar (white) ──────────────────────────────────── */}
        <View style={styles.filterBar}>
          {/* Stats inline */}
          <View style={styles.filterStats}>
            <Text style={styles.filterStatNum}>{count}</Text>
            <Text style={styles.filterStatLabel}>suppliers found</Text>
          </View>
          {/* Business type chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChips}
          >
            {BUSINESS_TYPES.map((type) => (
              <Pressable
                key={type.value}
                style={[
                  styles.filterChip,
                  activeType === type.value ? styles.filterChipActive : styles.filterChipInactive,
                ]}
                onPress={() => setActiveType(type.value)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeType === type.value ? styles.filterChipTextActive : styles.filterChipTextInactive,
                  ]}
                >
                  {type.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[
                styles.filterChip,
                wholesalerOnly ? styles.filterChipActive : styles.filterChipInactive,
              ]}
              onPress={() => setWholesalerOnly((v) => !v)}
            >
              <MaterialCommunityIcons
                name="shield-check"
                size={14}
                color={wholesalerOnly ? '#FFFFFF' : Brand.primary}
              />
              <Text
                style={[
                  styles.filterChipText,
                  wholesalerOnly ? styles.filterChipTextActive : styles.filterChipTextInactive,
                ]}
              >
                Trade Assurance
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* ── Loading ─────────────────────────────────────────────── */}
        {loading && stores.length === 0 ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading suppliers...</Text>
          </View>
        ) : stores.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons name="store-off-outline" size={48} color={Brand.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No suppliers found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters or search</Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => { setSearch(''); setActiveType(''); setWholesalerOnly(false); }}
            >
              <Text style={styles.emptyBtnText}>Clear Filters</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={stores}
            keyExtractor={(item, index) => `${item.id}-${item.slug}-${index}`}
            renderItem={renderStore}
            contentContainerStyle={styles.list}
            maxToRenderPerBatch={4}
            windowSize={7}
            initialNumToRender={6}
            removeClippedSubviews={true}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Brand.primary]}
                tintColor={Brand.primary}
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator size="small" color={Brand.primary} style={styles.footer} />
              ) : !hasMore ? (
                <Text style={styles.endText}>You've seen all {count} suppliers</Text>
              ) : null
            }
          />
        )}
        <ScrollToTopButton visible={showScrollTop} onPress={scrollToTop} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },

  // ── Header ──────────────────────────────────────────────────────
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 14, color: Brand.text, paddingVertical: 0, height: '100%' },

  // ── Filter bar ──────────────────────────────────────────────────
  filterBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.surfaceAlt,
  },
  filterStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  filterStatNum: { fontSize: 15, fontWeight: '800', color: Brand.text },
  filterStatLabel: { fontSize: 12, color: Brand.textSecondary },
  filterChips: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  filterChipInactive: { backgroundColor: Brand.surfaceAlt, borderColor: Brand.border },
  filterChipText: { fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#FFFFFF' },
  filterChipTextInactive: { color: Brand.textSecondary },

  // ── List ────────────────────────────────────────────────────────
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Brand.surfaceAlt,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },

  // ── Banner ──────────────────────────────────────────────────────
  bannerWrap: { position: 'relative', height: 100 },
  banner: { width: '100%', height: '100%' },
  bannerFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bannerBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeGold: { backgroundColor: Brand.accent },
  badgeVerified: { backgroundColor: '#16A34A' },
  badgeTA: { backgroundColor: 'rgba(0,0,0,0.6)' },
  bannerBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  // ── Card content ────────────────────────────────────────────────
  cardContent: { padding: 12 },
  logoRow: { flexDirection: 'row', gap: 12, marginTop: -28 },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Brand.primary,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  logo: { width: '100%', height: '100%' },
  logoFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  identity: { flex: 1, justifyContent: 'flex-end', paddingBottom: 4 },
  storeName: { fontSize: 16, fontWeight: '700', color: Brand.text, lineHeight: 21 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  typeText: { fontSize: 12, color: Brand.primary, fontWeight: '600' },
  dot: { fontSize: 12, color: Brand.textTertiary },
  locationText: { fontSize: 12, color: Brand.textSecondary },

  // ── Tagline ─────────────────────────────────────────────────────
  tagline: { fontSize: 13, color: Brand.textSecondary, lineHeight: 18, marginTop: 10 },

  // ── Stats row ───────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Brand.surfaceAlt,
    borderRadius: 8,
  },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { fontSize: 13, fontWeight: '700', color: Brand.text },
  statSub: { fontSize: 11, color: Brand.textSecondary },
  statDivider: { width: 1, height: 20, backgroundColor: Brand.border },

  // ── Footer ──────────────────────────────────────────────────────
  cardFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.primary,
    backgroundColor: Brand.surfaceAlt,
  },
  contactText: { fontSize: 13, fontWeight: '600', color: Brand.primary },
  visitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Brand.primary,
  },
  visitText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // ── States ──────────────────────────────────────────────────────
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, color: Brand.textSecondary, fontSize: 14 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Brand.surfaceAlt,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Brand.text },
  emptySubtext: { marginTop: 8, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
  emptyBtn: {
    marginTop: 20, backgroundColor: Brand.primary,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8,
  },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  footer: { paddingVertical: 16 },
  endText: { textAlign: 'center', paddingVertical: 16, color: Brand.textTertiary, fontSize: 13 },
});
