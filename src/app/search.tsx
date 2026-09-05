import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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

import { Brand } from '@/constants/theme';
import { fetchProducts, searchProducts } from '@/services/products';
import type { Product } from '@/types';

const TRENDING_SEARCHES = ['Phone', 'Shoes', 'Laptop', 'Watch', 'Headphones', 'Bag'];

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
            <MaterialCommunityIcons name="package-variant-closed" size={36} color="#D1D5DB" />
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
  const [products, setProducts] = useState<Product[]>([]);
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const load = useCallback(async (reset = false) => {
    const targetPage = reset ? 1 : page;
    if (reset) {
      setPage(1);
      setHasMore(true);
    }
    try {
      if (reset) setRefreshing(true);
      else setLoadingMore(true);
      const data = query
        ? await searchProducts(query, targetPage)
        : await fetchProducts({ page: targetPage });
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
  }, [page, query]);

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
    <View style={styles.searchBar}>
      <MaterialCommunityIcons name="magnify" size={22} color="#9CA3AF" />
      <TextInput
        ref={inputRef}
        style={styles.searchInput}
        value={query}
        onChangeText={setQuery}
        placeholder="Search products on Diilzo..."
        placeholderTextColor="#9CA3AF"
        autoCapitalize="none"
        returnKeyType="search"
      />
      {query.length > 0 && (
        <Pressable onPress={clearQuery} hitSlop={8} style={styles.clearBtn}>
          <MaterialCommunityIcons name="close-circle" size={20} color="#9CA3AF" />
        </Pressable>
      )}
    </View>
  );

  // ── Loading state ────────────────────────────────────────────────
  if (loading && products.length === 0) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <LinearGradient
            colors={['#e55f00', '#ff6a00', '#ff8520']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <SearchBar />
          </LinearGradient>
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
          colors={['#e55f00', '#ff6a00', '#ff8520']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <SearchBar />
        </LinearGradient>

        {/* ── Trending searches (only when no query) ─────────────── */}
        {query.length === 0 && (
          <View style={styles.trendingSection}>
            <View style={styles.trendingHeader}>
              <MaterialCommunityIcons name="fire" size={18} color={Brand.primary} />
              <Text style={styles.trendingTitle}>Trending Searches</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendingChips}
            >
              {TRENDING_SEARCHES.map((term) => (
                <Pressable
                  key={term}
                  style={styles.trendingChip}
                  onPress={() => setQuery(term)}
                >
                  <MaterialCommunityIcons name="trending-up" size={14} color={Brand.primary} />
                  <Text style={styles.trendingChipText}>{term}</Text>
                </Pressable>
              ))}
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
              <MaterialCommunityIcons name="magnify-close" size={48} color="#9CA3AF" />
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
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
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
    borderBottomColor: '#F3F4F6',
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  trendingTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  trendingChips: { gap: 8 },
  trendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF3E8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE0C2',
  },
  trendingChipText: { fontSize: 13, fontWeight: '600', color: Brand.primary },

  // ── Count bar ───────────────────────────────────────────────────
  countBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  countText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
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
    backgroundColor: '#F9FAFB',
    aspectRatio: 1,
  },
  image: { width: '100%', height: '100%' },
  noImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  saleBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF4747',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  saleBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  cardBody: { padding: 10, gap: 4 },
  name: { fontSize: 13, fontWeight: '600', lineHeight: 18, color: '#1F2937' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 11, fontWeight: '600', color: Brand.rating, marginLeft: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 2 },
  currency: { fontSize: 11, fontWeight: '600', color: '#1F2937' },
  price: { fontSize: 16, fontWeight: '700', color: '#1F2937' },

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
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
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
  loadingText: { marginTop: 8, color: '#6B7280', fontSize: 14 },

  // ── Footer ──────────────────────────────────────────────────────
  footer: { paddingVertical: 16 },
  endText: {
    textAlign: 'center',
    paddingVertical: 16,
    color: '#9CA3AF',
    fontSize: 13,
  },
});
