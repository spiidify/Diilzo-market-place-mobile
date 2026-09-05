import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
import { fetchProducts, searchProducts } from '@/services/products';
import type { Product } from '@/types';

const TRENDING_SEARCHES: { term: string; icon: string }[] = [
  { term: 'Phone', icon: 'cellphone' },
  { term: 'Laptop', icon: 'laptop' },
  { term: 'Shoes', icon: 'shoe-sneaker' },
  { term: 'Watch', icon: 'watch' },
  { term: 'Headphones', icon: 'headphones' },
  { term: 'Bag', icon: 'shopping' },
  { term: 'Camera', icon: 'camera' },
  { term: 'TV', icon: 'television' },
];

// ── Fetch a thumbnail image for each trending term from the backend ──
async function fetchTrendingImages(): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.all(
    TRENDING_SEARCHES.map(async ({ term }) => {
      try {
        const data = await searchProducts(term, 1);
        const product = data.results.find((p) => p.primary_image_url);
        if (product?.primary_image_url) {
          results[term] = product.primary_image_url;
        }
      } catch {
        // ignore — fallback to icon
      }
    })
  );
  return results;
}

// ── Memoized product card ───────────────────────────────────────────
const SearchProductCard = memo(function SearchProductCard({
  item,
  onPress,
}: {
  item: Product;
  onPress: (slug: string) => void;
}) {
  const onSale = item.is_on_sale && item.sale_price;
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(item.slug)}
    >
      <View style={styles.imageWrap}>
        {item.primary_image_url ? (
          <Image source={{ uri: item.primary_image_url }} style={styles.image} contentFit="cover" transition={200} />
        ) : (
          <View style={styles.noImage}>
            <MaterialCommunityIcons name="package-variant-closed" size={36} color={Brand.textTertiary} />
          </View>
        )}
        {onSale && (
          <View style={styles.saleBadge}>
            <Text style={styles.saleBadgeText}>-{Math.round(item.discount_percentage || 0)}%</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        {(() => {
          const value = parseFloat(item.rating) || 0;
          if (value <= 0) return null;
          return (
            <View style={styles.ratingRow}>
              <MaterialCommunityIcons name="star" size={12} color={Brand.rating} />
              <Text style={styles.ratingText}>{value.toFixed(1)}</Text>
            </View>
          );
        })()}
        <View style={styles.priceRow}>
          <Text style={styles.currency}>{item.currency}</Text>
          <Text style={styles.price}>{Number(item.final_price).toLocaleString()}</Text>
        </View>
      </View>
    </Pressable>
  );
});

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; categoryName?: string }>();
  const categorySlug = params.category || null;
  const [products, setProducts] = useState<Product[]>([]);
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [trendingImages, setTrendingImages] = useState<Record<string, string>>({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);

  // Fetch real product images for trending searches on mount
  useEffect(() => {
    fetchTrendingImages().then(setTrendingImages);
  }, []);

  const load = useCallback(async (reset = false) => {
    const targetPage = reset ? 1 : page;
    if (reset) {
      setPage(1);
      setHasMore(true);
    }
    try {
      if (reset) setRefreshing(true);
      else setLoadingMore(true);
      const baseParams = {
        page: targetPage,
        ...(categorySlug ? { category: categorySlug } : {}),
        ...(sortBy ? { ordering: sortBy } : {}),
        ...(minPrice ? { min_price: minPrice } : {}),
        ...(maxPrice ? { max_price: maxPrice } : {}),
        ...(onSaleOnly ? { on_sale: 'true' as const } : {}),
      };
      const data = query
        ? await searchProducts(query, targetPage, baseParams)
        : await fetchProducts(baseParams);
      setProducts((prev) => (reset ? data.results : [...prev, ...data.results]));
      setCount(data.count);
      setHasMore(data.next !== null);
      if (!reset) setPage(targetPage + 1);
    } catch (e: any) {
      console.error('Search load error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [page, query, categorySlug]);

  useEffect(() => {
    load(true);
  }, []);

  // Debounced search (400ms)
  useEffect(() => {
    const t = setTimeout(() => load(true), 400);
    return () => clearTimeout(t);
  }, [query]);

  // Auto-focus the input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || refreshing) return;
    load(false);
  }, [hasMore, loadingMore, refreshing, load]);

  const handleScroll = useCallback((event: any) => {
    setShowScrollTop(event.nativeEvent.contentOffset.y > 300);
  }, []);

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const clearQuery = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const renderStars = (rating: string) => {
    const value = parseFloat(rating) || 0;
    if (value <= 0) return null;
    return (
      <View style={styles.ratingRow}>
        <MaterialCommunityIcons name="star" size={12} color={Brand.rating} />
        <Text style={styles.ratingText}>{value.toFixed(1)}</Text>
      </View>
    );
  };

  const handleProductPress = useCallback((slug: string) => {
    router.push(`/product/${slug}`);
  }, [router]);

  const renderProduct = useCallback(
    ({ item }: { item: Product }) => (
      <SearchProductCard item={item} onPress={handleProductPress} />
    ),
    [handleProductPress]
  );

  const showEmpty = !loading && !refreshing && products.length === 0 && query.length > 0;

  // ── Search bar component (reused in all states) ──────────────────
  const SearchBar = () => (
    <View style={styles.searchRow}>
      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={22} color={Brand.textTertiary} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search products on Diilzo..."
          placeholderTextColor={Brand.textTertiary}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={clearQuery} hitSlop={8} style={styles.clearBtn}>
            <MaterialCommunityIcons name="close-circle" size={20} color={Brand.textTertiary} />
          </Pressable>
        )}
      </View>
      <Pressable style={[styles.filterBtn, showFilters && styles.filterBtnActive]} onPress={() => setShowFilters(!showFilters)}>
        <MaterialCommunityIcons name="filter-variant" size={22} color={showFilters ? '#FFFFFF' : Brand.primary} />
      </Pressable>
    </View>
  );

  const FilterPanel = () => {
    if (!showFilters) return null;
    return (
      <View style={styles.filterPanel}>
        <Text style={styles.filterLabel}>Sort By</Text>
        <View style={styles.sortRow}>
          {[
            { label: 'Newest', value: '-created_at' },
            { label: 'Price: Low→High', value: 'price' },
            { label: 'Price: High→Low', value: '-price' },
            { label: 'Top Rated', value: '-rating' },
          ].map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.sortChip, sortBy === opt.value && styles.sortChipActive]}
              onPress={() => { setSortBy(opt.value); load(true); }}
            >
              <Text style={[styles.sortChipText, sortBy === opt.value && styles.sortChipTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.filterLabel}>Price Range (UGX)</Text>
        <View style={styles.filterPriceRow}>
          <TextInput
            style={styles.priceInput}
            value={minPrice}
            onChangeText={setMinPrice}
            placeholder="Min"
            keyboardType="numeric"
            placeholderTextColor={Brand.textTertiary}
          />
          <Text style={styles.priceDash}>—</Text>
          <TextInput
            style={styles.priceInput}
            value={maxPrice}
            onChangeText={setMaxPrice}
            placeholder="Max"
            keyboardType="numeric"
            placeholderTextColor={Brand.textTertiary}
          />
          <Pressable style={styles.applyBtn} onPress={() => load(true)}>
            <Text style={styles.applyBtnText}>Apply</Text>
          </Pressable>
        </View>
        <Pressable
          style={[styles.saleToggle, onSaleOnly && styles.saleToggleActive]}
          onPress={() => { setOnSaleOnly(!onSaleOnly); load(true); }}
        >
          <MaterialCommunityIcons
            name={onSaleOnly ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={20}
            color={onSaleOnly ? Brand.primary : Brand.textTertiary}
          />
          <Text style={styles.saleToggleText}>On Sale Only</Text>
        </Pressable>
      </View>
    );
  };

  // ── Loading state ────────────────────────────────────────────────
  if (loading && products.length === 0) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <LinearGradient
            colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <SearchBar />
          </LinearGradient>
          <FilterPanel />
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* ── Orange gradient header with search bar ─────────────── */}
        <LinearGradient
          colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <SearchBar />
        </LinearGradient>
        <FilterPanel />

        {/* ── Trending searches with images (only when no query) ──── */}
        {query.length === 0 && (
          <View style={styles.trendingSection}>
            <View style={styles.trendingHeader}>
              <MaterialCommunityIcons name="fire" size={18} color={Brand.primary} />
              <Text style={styles.trendingTitle}>Trending Searches</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendingCards}
            >
              {TRENDING_SEARCHES.map((item) => {
                const img = trendingImages[item.term];
                return (
                  <Pressable
                    key={item.term}
                    style={({ pressed }) => [styles.trendingCard, pressed && { opacity: 0.85 }]}
                    onPress={() => setQuery(item.term)}
                  >
                    <View style={styles.trendingCardImage}>
                      {img ? (
                        <Image source={{ uri: img }} style={styles.trendingCardImg} contentFit="cover" transition={200} />
                      ) : (
                        <View style={styles.trendingCardFallback}>
                          <MaterialCommunityIcons name={item.icon as any} size={28} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.trendingCardLabel} numberOfLines={1}>{item.term}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Results count bar ──────────────────────────────────── */}
        {!showEmpty && (
          <View style={styles.countBar}>
            <Text style={styles.countText}>
              {count > 0 ? `${count} products found` : 'Loading...'}
            </Text>
            {query.length > 0 && (
              <View style={styles.queryTag}>
                <Text style={styles.queryTagText}>"{query}"</Text>
                <Pressable onPress={clearQuery} hitSlop={8}>
                  <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* ── Empty state ────────────────────────────────────────── */}
        {showEmpty ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons name="magnify-close" size={48} color={Brand.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySubtext}>
              We couldn't find anything for "{query}".{'\n'}Try a different search term.
            </Text>
            <Pressable style={styles.emptyBtn} onPress={clearQuery}>
              <Text style={styles.emptyBtnText}>Clear Search</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={products}
            keyExtractor={(item, index) => `${item.id}-${item.slug}-${index}`}
            renderItem={renderProduct}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.list}
            maxToRenderPerBatch={6}
            windowSize={7}
            initialNumToRender={8}
            removeClippedSubviews={true}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListHeaderComponent={
              categorySlug ? (
                <View style={styles.categoryBanner}>
                  <Pressable onPress={() => router.back()} hitSlop={12} style={styles.categoryBackBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.primary} />
                  </Pressable>
                  <Text style={styles.categoryBannerTitle}>{params.categoryName || 'Category'}</Text>
                  <View style={{ width: 22 }} />
                </View>
              ) : null
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
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
                <Text style={styles.endText}>No more products</Text>
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Brand.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Brand.primary,
  },
  filterBtnActive: {
    backgroundColor: Brand.primary,
  },
  filterPanel: {
    backgroundColor: Brand.surface,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Brand.borderLight,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.textSecondary,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Brand.surfaceAlt,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  sortChipActive: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.textSecondary,
  },
  sortChipTextActive: {
    color: '#FFFFFF',
  },
  filterPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceInput: {
    flex: 1,
    backgroundColor: Brand.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: Brand.text,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  priceDash: {
    color: Brand.textTertiary,
    fontSize: 16,
  },
  applyBtn: {
    backgroundColor: Brand.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  saleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  saleToggleActive: {},
  saleToggleText: {
    fontSize: 14,
    color: Brand.text,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Brand.text,
    paddingVertical: 0,
    height: '100%',
  },
  clearBtn: { paddingVertical: 4 },

  // ── Trending ────────────────────────────────────────────────────
  trendingSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.surfaceAlt,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  trendingTitle: { fontSize: 14, fontWeight: '700', color: Brand.text },
  trendingCards: { gap: 14, paddingHorizontal: 2 },
  trendingCard: {
    alignItems: 'center',
    width: 72,
  },
  trendingCardImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Brand.surfaceAlt,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  trendingCardImg: {
    width: '100%',
    height: '100%',
  },
  trendingCardFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendingCardLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: Brand.textSecondary,
    textAlign: 'center',
  },

  // ── Count bar ───────────────────────────────────────────────────
  countBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.surfaceAlt,
  },
  countText: { fontSize: 13, color: Brand.textSecondary, fontWeight: '500' },
  queryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Brand.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  queryTagText: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' },

  // ── List ────────────────────────────────────────────────────────
  list: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 20,
  },
  row: { gap: 10, marginBottom: 10 },

  // ── Card ────────────────────────────────────────────────────────
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  imageWrap: {
    position: 'relative',
    backgroundColor: Brand.surfaceAlt,
    aspectRatio: 1,
  },
  image: { width: '100%', height: '100%' },
  noImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Brand.surfaceAlt,
  },
  saleBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Brand.danger,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  saleBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  cardBody: { padding: 10, gap: 4 },
  name: { fontSize: 13, fontWeight: '600', lineHeight: 18, color: Brand.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 11, fontWeight: '600', color: Brand.rating, marginLeft: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 2 },
  currency: { fontSize: 11, fontWeight: '600', color: Brand.text },
  price: { fontSize: 16, fontWeight: '700', color: Brand.text },

  // ── Empty state ─────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Brand.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Brand.text },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: Brand.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: Brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // ── Loading ─────────────────────────────────────────────────────
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, color: Brand.textSecondary, fontSize: 14 },

  // ── Footer ──────────────────────────────────────────────────────
  footer: { paddingVertical: 16 },
  endText: {
    textAlign: 'center',
    paddingVertical: 16,
    color: Brand.textTertiary,
    fontSize: 13,
  },
  categoryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 4,
  },
  categoryBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.text,
  },
});
