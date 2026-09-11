import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
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
import {
  esSearchProducts,
  fetchProducts,
  getAutocomplete,
  getTrendingSearches,
  logSearchClick,
  searchProducts,
} from '@/services/products';
import type { Product } from '@/types';

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT = 8;

// Fallback trending searches — used if the API call fails
const FALLBACK_TRENDING: { term: string; icon: string }[] = [
  { term: 'Phone', icon: 'cellphone' },
  { term: 'Laptop', icon: 'laptop' },
  { term: 'Shoes', icon: 'shoe-sneaker' },
  { term: 'Watch', icon: 'watch' },
  { term: 'Headphones', icon: 'headphones' },
  { term: 'Bag', icon: 'shopping' },
  { term: 'Camera', icon: 'camera' },
  { term: 'TV', icon: 'television' },
];

const SORT_OPTIONS = [
  { label: 'Newest', value: '-created_at' },
  { label: 'Price ↑', value: 'price' },
  { label: 'Price ↓', value: '-price' },
  { label: 'Top Rated', value: '-rating' },
];

// ── Fetch a thumbnail image for each trending term from the backend ──
async function fetchTrendingImages(
  trendingTerms: { term: string; icon: string }[]
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.all(
    trendingTerms.map(async ({ term }) => {
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

// ── Sponsored product card (horizontal scroll) ─────────────────────
const SponsoredProductCard = memo(function SponsoredProductCard({
  item,
  onPress,
  badgeText,
  badgeColor,
}: {
  item: Product;
  onPress: (slug: string) => void;
  badgeText: string;
  badgeColor: string;
}) {
  return (
    <Pressable
      style={styles.sponsoredCard}
      onPress={() => onPress(item.slug)}
    >
      <View style={styles.sponsoredImgWrap}>
        {item.primary_image_url ? (
          <Image source={{ uri: item.primary_image_url }} style={styles.sponsoredImg} resizeMode="contain" />
        ) : (
          <View style={[styles.sponsoredImg, { backgroundColor: Brand.surfaceAlt }]}>
            <MaterialCommunityIcons name="image-off-outline" size={28} color={Brand.textTertiary} />
          </View>
        )}
        <View style={[styles.sponsoredBadge, { backgroundColor: badgeColor }]}>
          <Text style={styles.sponsoredBadgeText}>{badgeText}</Text>
        </View>
      </View>
      <Text style={styles.sponsoredName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.sponsoredPrice}>UGX {Number(item.final_price).toLocaleString()}</Text>
    </Pressable>
  );
});

// ── Memoized product card ───────────────────────────────────────────
const SearchProductCard = memo(function SearchProductCard({
  item,
  onPress,
}: {
  item: Product;
  onPress: (slug: string) => void;
}) {
  const onSale = item.is_on_sale && item.sale_price;
  const rating = parseFloat(item.rating) || 0;
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(item.slug)}
    >
      <View style={styles.imageWrap}>
        {item.primary_image_url ? (
          <Image source={{ uri: item.primary_image_url }} style={styles.image} resizeMode="contain" />
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
        {rating > 0 && (
          <View style={styles.ratingRow}>
            <MaterialCommunityIcons name="star" size={12} color={Brand.rating} />
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
          </View>
        )}
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
  const params = useLocalSearchParams<{ category?: string; categoryName?: string; brand?: string; brandName?: string }>();
  const categorySlug = params.category || null;
  const brandSlug = params.brand || null;
  const contextTitle = categorySlug ? (params.categoryName || 'Category') : brandSlug ? (params.brandName || 'Brand') : null;

  const [products, setProducts] = useState<Product[]>([]);
  const [pinned, setPinned] = useState<Product[]>([]);
  const [sponsored, setSponsored] = useState<Product[]>([]);
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [trendingImages, setTrendingImages] = useState<Record<string, string>>({});
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [trendingSearches, setTrendingSearches] = useState<{ term: string; icon: string }[]>(FALLBACK_TRENDING);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);
  // AbortController for the in-flight search request. Each new keystroke
  // (or filter change) cancels the previous request so we never render
  // stale results that arrive out of order on slow networks.
  const abortRef = useRef<AbortController | null>(null);
  // Separate AbortController for autocomplete requests
  const autocompleteAbortRef = useRef<AbortController | null>(null);

  // Load trending searches from API + trending images + recent searches on mount
  useEffect(() => {
    // Fetch trending searches from the backend API
    getTrendingSearches(8).then((terms) => {
      if (terms.length > 0) {
        const apiTrending = terms.map((term, i) => ({
          term,
          icon: FALLBACK_TRENDING[i % FALLBACK_TRENDING.length].icon,
        }));
        setTrendingSearches(apiTrending);
        fetchTrendingImages(apiTrending).then(setTrendingImages).catch(() => { });
      } else {
        fetchTrendingImages(FALLBACK_TRENDING).then(setTrendingImages).catch(() => { });
      }
    }).catch(() => {
      fetchTrendingImages(FALLBACK_TRENDING).then(setTrendingImages).catch(() => { });
    });
    AsyncStorage.getItem(RECENT_SEARCHES_KEY).then((raw) => {
      if (raw) {
        try { setRecentSearches(JSON.parse(raw)); } catch { }
      }
    }).catch(() => { });
  }, []);

  const load = useCallback(async (reset = false, userRefresh = false) => {
    const targetPage = reset ? 1 : page;
    if (reset) {
      setPage(1);
      setHasMore(true);
    }
    // Cancel any in-flight request before issuing a new one. This prevents
    // stale responses from a slower prior query (e.g. "pho") from
    // overwriting the results of a faster newer query (e.g. "phone").
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (reset && userRefresh) setRefreshing(true);
      else if (!reset) setLoadingMore(true);
      const baseParams = {
        page: targetPage,
        ...(categorySlug ? { category: categorySlug } : {}),
        ...(brandSlug ? { brand: brandSlug } : {}),
        ...(sortBy ? { ordering: sortBy } : {}),
        ...(minPrice ? { min_price: minPrice } : {}),
        ...(maxPrice ? { max_price: maxPrice } : {}),
        ...(onSaleOnly ? { on_sale: 'true' as const } : {}),
      };
      // ── Use PostgreSQL FTS search endpoint when there's a text query ─
      // esSearchProducts hits /api/v1/search/ which uses PostgreSQL
      // SearchVector + SearchRank + pg_trgm + composite ranking.
      // When no query (browsing by category/brand), use the regular feed.
      if (query && query.trim().length >= 2) {
        const data = await esSearchProducts({
          q: query,
          page: targetPage,
          page_size: 20,
          ordering: sortBy || undefined,
          ...(categorySlug ? { category: categorySlug } : {}),
          ...(brandSlug ? { brand: brandSlug } : {}),
          ...(minPrice ? { min_price: minPrice } : {}),
          ...(maxPrice ? { max_price: maxPrice } : {}),
          ...(onSaleOnly ? { on_sale: 'true' } : {}),
          ...(inStockOnly ? { in_stock: 'true' } : {}),
          ...(verifiedOnly ? { verified: 'true' } : {}),
          signal: controller.signal,
        });
        // If a newer request superseded this one, drop the stale result.
        if (controller.signal.aborted) return;
        if (reset) {
          setPinned([]);
          setSponsored([]);
          setSuggestion(data.suggestion || null);
        }
        setProducts((prev) => {
          if (reset) return data.results;
          // Defensive dedup: if the same page is fetched twice (e.g. a
          // race between loadMore calls), drop items already present.
          const existingIds = new Set(prev.map((p) => p.id));
          const fresh = data.results.filter((p) => !existingIds.has(p.id));
          return [...prev, ...fresh];
        });
        setCount(data.count);
        setHasMore(data.has_next);
        // Always advance page — for reset, targetPage is 1 so next is 2.
        setPage(targetPage + 1);
      } else if (query && query.trim().length > 0 && query.trim().length < 2) {
        // Below 3-char threshold — instantly clear the UI list
        if (reset) {
          setPinned([]);
          setSponsored([]);
        }
        setProducts([]);
        setCount(0);
        setHasMore(false);
      } else {
        // No query — browse all (with category/brand filters)
        const data = await fetchProducts({ ...baseParams, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (reset) {
          setPinned(data.pinned || []);
          setSponsored(data.sponsored || []);
        }
        setProducts((prev) => {
          if (reset) return data.results;
          const existingIds = new Set(prev.map((p) => p.id));
          const fresh = data.results.filter((p) => !existingIds.has(p.id));
          return [...prev, ...fresh];
        });
        setCount(data.count);
        setHasMore(data.next !== null);
        setPage(targetPage + 1);
      }
    } catch (e: any) {
      // axios throws a CanceledError when the AbortController fires —
      // that's expected, not an error to surface to the user.
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || controller.signal.aborted) {
        return;
      }
      console.error('Search load error:', e?.message);
    } finally {
      // Only clear loading flags if this is still the active request.
      if (abortRef.current === controller) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [page, query, categorySlug, brandSlug, sortBy, minPrice, maxPrice, onSaleOnly, inStockOnly, verifiedOnly]);

  useEffect(() => {
    load(true);
    return () => {
      // Cancel any in-flight search request when the screen unmounts.
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // ── Debounced search (300ms) ──────────────────────────────────────
  // 300ms debounce protects the server from request spam while typing.
  // Uses setTimeout cleanup function to cancel pending requests on each keystroke.
  // Instantly clears the UI list if the input is wiped blank.
  useEffect(() => {
    // If query is blank, instantly clear results (no debounce needed)
    if (query.trim().length === 0) {
      setProducts([]);
      setPinned([]);
      setSponsored([]);
      setCount(0);
      setHasMore(false);
      setLoading(false);
      setSuggestion(null);
      setAutocompleteItems([]);
      setShowAutocomplete(false);
      return;
    }
    // 300ms debounce — cancel previous timer on each keystroke
    const t = setTimeout(() => {
      load(true);
      setShowAutocomplete(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // ── Autocomplete debounce (150ms) ─────────────────────────────────
  // Faster than the full search debounce so suggestions appear quickly
  // as the user types, without waiting for full search results.
  useEffect(() => {
    if (query.trim().length < 2) {
      setAutocompleteItems([]);
      setShowAutocomplete(false);
      return;
    }
    // Cancel any in-flight autocomplete request
    if (autocompleteAbortRef.current) {
      autocompleteAbortRef.current.abort();
    }
    const t = setTimeout(async () => {
      try {
        const suggestions = await getAutocomplete(query.trim(), 6);
        // Only show if query hasn't changed during the request
        if (suggestions.length > 0) {
          setAutocompleteItems(suggestions);
          setShowAutocomplete(true);
        } else {
          setShowAutocomplete(false);
        }
      } catch {
        // Silently fail — autocomplete is a nice-to-have
      }
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  // Auto-focus on mount only when there is no category/brand context
  useEffect(() => {
    if (contextTitle) return;
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [contextTitle]);

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

  // ── Recent searches helpers ───────────────────────────────────────
  const saveRecentSearch = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => { });
      return next;
    });
  }, []);

  const removeRecentSearch = useCallback((term: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((t) => t !== term);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => { });
      return next;
    });
  }, []);

  const clearAllRecent = useCallback(() => {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_SEARCHES_KEY).catch(() => { });
  }, []);

  const handleSubmitSearch = useCallback(() => {
    if (query.trim()) saveRecentSearch(query);
    Keyboard.dismiss();
    load(true);
  }, [query, saveRecentSearch, load]);

  const handleProductPress = useCallback((slug: string) => {
    if (query.trim()) {
      saveRecentSearch(query);
      // Log search click for analytics (fire-and-forget)
      const product = products.find((p) => p.slug === slug);
      logSearchClick(query.trim(), product?.id, undefined).catch(() => { });
    }
    router.push(`/product/${slug}`);
  }, [router, query, saveRecentSearch, products]);

  const renderProduct = useCallback(
    ({ item }: { item: Product }) => (
      <SearchProductCard item={item} onPress={handleProductPress} />
    ),
    [handleProductPress]
  );

  const showEmpty = !loading && !refreshing && products.length === 0 && query.trim().length >= 2;
  const isIdle = query.length === 0 && !categorySlug && !brandSlug;
  // Show a hint when query is 1 char (below 2-char threshold)
  const showMinHint = query.trim().length > 0 && query.trim().length < 2;

  // ── Header: back + search bar + filter ───────────────────────────
  // Rendered as inline JSX (NOT nested components) — nested component
  // functions remount on every keystroke, causing the TextInput to lose
  // focus and taps to land on product cards (accidental navigation).
  const searchHeader = (
    <View style={styles.headerWrap}>
      <View style={styles.searchRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Brand.text} />
        </Pressable>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={Brand.textTertiary} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search products on Diilzo..."
            placeholderTextColor={Brand.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleSubmitSearch}
            onFocus={() => { if (autocompleteItems.length > 0) setShowAutocomplete(true); }}
          />
          {query.length > 0 && (
            <Pressable onPress={clearQuery} hitSlop={8}>
              <MaterialCommunityIcons name="close-circle" size={18} color={Brand.textTertiary} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.filterBtn, (showFilters || sortBy || minPrice || maxPrice || onSaleOnly || inStockOnly || verifiedOnly) && styles.filterBtnActive]}
          onPress={() => { setShowFilters((v) => !v); setShowAutocomplete(false); }}
        >
          <MaterialCommunityIcons
            name="tune"
            size={20}
            color={(showFilters || sortBy || minPrice || maxPrice || onSaleOnly || inStockOnly || verifiedOnly) ? '#FFFFFF' : Brand.text}
          />
        </Pressable>
      </View>
      {/* ── Autocomplete dropdown ─────────────────────────────────── */}
      {showAutocomplete && autocompleteItems.length > 0 && (
        <View style={styles.autocompleteDropdown}>
          {autocompleteItems.map((item, idx) => (
            <Pressable
              key={`ac-${idx}`}
              style={styles.autocompleteItem}
              onPress={() => {
                setQuery(item);
                setShowAutocomplete(false);
              }}
            >
              <MaterialCommunityIcons name="magnify" size={16} color={Brand.textTertiary} />
              <Text style={styles.autocompleteText} numberOfLines={1}>{item}</Text>
              <MaterialCommunityIcons name="arrow-top-left" size={14} color={Brand.textTertiary} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  // ── Filter panel ──────────────────────────────────────────────────
  // Inline JSX — see searchHeader comment above.
  const filterPanel = showFilters ? (
    <View style={styles.filterPanel}>
      <Text style={styles.filterLabel}>Sort By</Text>
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.sortChip, sortBy === opt.value && styles.sortChipActive]}
            onPress={() => { setSortBy(sortBy === opt.value ? '' : opt.value); load(true); }}
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
      <View style={styles.filterFooter}>
        <View style={styles.filterTogglesRow}>
          <Pressable
            style={styles.saleToggle}
            onPress={() => { setOnSaleOnly(!onSaleOnly); load(true); }}
          >
            <MaterialCommunityIcons
              name={onSaleOnly ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={20}
              color={onSaleOnly ? Brand.primary : Brand.textTertiary}
            />
            <Text style={styles.saleToggleText}>On Sale</Text>
          </Pressable>
          <Pressable
            style={styles.saleToggle}
            onPress={() => { setInStockOnly(!inStockOnly); load(true); }}
          >
            <MaterialCommunityIcons
              name={inStockOnly ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={20}
              color={inStockOnly ? Brand.primary : Brand.textTertiary}
            />
            <Text style={styles.saleToggleText}>In Stock</Text>
          </Pressable>
          <Pressable
            style={styles.saleToggle}
            onPress={() => { setVerifiedOnly(!verifiedOnly); load(true); }}
          >
            <MaterialCommunityIcons
              name={verifiedOnly ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={20}
              color={verifiedOnly ? Brand.primary : Brand.textTertiary}
            />
            <Text style={styles.saleToggleText}>Verified</Text>
          </Pressable>
        </View>
        {(sortBy || minPrice || maxPrice || onSaleOnly || inStockOnly || verifiedOnly) ? (
          <Pressable
            onPress={() => {
              setSortBy('');
              setMinPrice('');
              setMaxPrice('');
              setOnSaleOnly(false);
              setInStockOnly(false);
              setVerifiedOnly(false);
              setShowFilters(false);
              setTimeout(() => load(true), 0);
            }}
            hitSlop={8}
          >
            <Text style={styles.clearFiltersText}>Clear all</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  ) : null;

  // ── Idle state: recent + trending searches ───────────────────────
  // Inline JSX — see searchHeader comment above.
  const idleBody = (
    <ScrollView
      style={styles.idleScroll}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {recentSearches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="history" size={18} color={Brand.textSecondary} />
              <Text style={styles.sectionTitle}>Recent Searches</Text>
            </View>
            <Pressable onPress={clearAllRecent} hitSlop={8}>
              <Text style={styles.clearAllText}>Clear</Text>
            </Pressable>
          </View>
          <View style={styles.recentWrap}>
            {recentSearches.map((term) => (
              <Pressable
                key={term}
                style={({ pressed }) => [styles.recentChip, pressed && { opacity: 0.8 }]}
                onPress={() => setQuery(term)}
              >
                <MaterialCommunityIcons name="history" size={13} color={Brand.textTertiary} />
                <Text style={styles.recentChipText} numberOfLines={1}>{term}</Text>
                <Pressable onPress={() => removeRecentSearch(term)} hitSlop={6}>
                  <MaterialCommunityIcons name="close" size={13} color={Brand.textTertiary} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name="fire" size={18} color={Brand.danger} />
          <Text style={styles.sectionTitle}>Trending Now</Text>
        </View>
        <View style={styles.trendingGrid}>
          {trendingSearches.map((item) => {
            const img = trendingImages[item.term];
            return (
              <Pressable
                key={item.term}
                style={({ pressed }) => [styles.trendingCard, pressed && { opacity: 0.85 }]}
                onPress={() => setQuery(item.term)}
              >
                {img ? (
                  <Image source={{ uri: img }} style={styles.trendingImg} resizeMode="contain" />
                ) : (
                  <View style={[styles.trendingImg, styles.trendingImgFallback]}>
                    <MaterialCommunityIcons name={item.icon as any} size={24} color={Brand.primary} />
                  </View>
                )}
                <View style={styles.trendingLabelRow}>
                  <Text style={styles.trendingLabel} numberOfLines={1}>{item.term}</Text>
                  <MaterialCommunityIcons name="arrow-top-right" size={14} color={Brand.textTertiary} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );

  // ── Loading state ────────────────────────────────────────────────
  if (loading && products.length === 0) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          {searchHeader}
          {contextTitle && (
            <Text style={styles.contextTitle} numberOfLines={1}>{contextTitle}</Text>
          )}
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
        {searchHeader}
        {contextTitle && !query && (
          <View style={styles.contextBar}>
            <Text style={styles.contextTitle} numberOfLines={1}>{contextTitle}</Text>
            {!showEmpty && count > 0 && (
              <Text style={styles.contextCount}>{count} products</Text>
            )}
          </View>
        )}
        {filterPanel}

        {isIdle ? (
          idleBody
        ) : (
          <>
            {/* ── Search info bar ─────────────────────────────── */}
            {query.length > 0 && !showEmpty && (
              <View style={styles.countBar}>
                <Text style={styles.countText}>
                  {count > 0 ? `${count} results for ` : 'Loading...'}
                  {count > 0 && <Text style={styles.countQuery}>"{query}"</Text>}
                </Text>
                <Pressable onPress={clearQuery} hitSlop={8}>
                  <Text style={styles.clearQueryText}>Clear</Text>
                </Pressable>
              </View>
            )}

            {/* ── "Did you mean" suggestion bar ─────────────────── */}
            {suggestion && (
              <View style={styles.suggestionBar}>
                <MaterialCommunityIcons name="lightbulb-outline" size={16} color={Brand.rating} />
                <Text style={styles.suggestionText}>
                  Did you mean{' '}
                  <Text
                    style={styles.suggestionLink}
                    onPress={() => { setQuery(suggestion); setSuggestion(null); }}
                  >
                    "{suggestion}"
                  </Text>
                  ?
                </Text>
              </View>
            )}

            {/* ── Minimum character hint (1-2 chars) ──────────── */}
            {showMinHint ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <MaterialCommunityIcons name="keyboard-outline" size={40} color={Brand.textTertiary} />
                </View>
                <Text style={styles.emptyTitle}>Keep typing</Text>
                <Text style={styles.emptySubtext}>
                  Enter at least 3 characters to search.
                </Text>
              </View>
            ) : showEmpty ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <MaterialCommunityIcons name="magnify-close" size={40} color={Brand.textTertiary} />
                </View>
                <Text style={styles.emptyTitle}>No items found</Text>
                <Text style={styles.emptySubtext}>
                  We couldn't find anything for "{query}".{'\n'}Check the spelling or try a different term.
                </Text>
                {suggestion && (
                  <Pressable
                    style={styles.suggestionBtn}
                    onPress={() => { setQuery(suggestion); setSuggestion(null); }}
                  >
                    <MaterialCommunityIcons name="lightbulb-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.suggestionBtnText}>Search "{suggestion}" instead</Text>
                  </Pressable>
                )}
                <Pressable style={styles.emptyBtn} onPress={clearQuery}>
                  <Text style={styles.emptyBtnText}>Clear Search</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={products}
                keyExtractor={(item) => `${item.id}-${item.slug}`}
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
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  <View>
                    {/* Pinned products (TOP Ads) */}
                    {pinned.length > 0 && (
                      <View style={styles.promoSection}>
                        <View style={styles.promoSectionHeader}>
                          <MaterialCommunityIcons name="pin" size={16} color={Brand.rating} />
                          <Text style={styles.promoSectionTitle}>TOP Ads</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {pinned.map((item) => (
                            <SponsoredProductCard
                              key={`pinned-${item.id}`}
                              item={item}
                              onPress={handleProductPress}
                              badgeText="TOP AD"
                              badgeColor={Brand.rating}
                            />
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {/* Sponsored products (CPC) */}
                    {sponsored.length > 0 && (
                      <View style={styles.promoSection}>
                        <View style={styles.promoSectionHeader}>
                          <MaterialCommunityIcons name="bullhorn-outline" size={16} color="#3B82F6" />
                          <Text style={styles.promoSectionTitle}>Sponsored</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {sponsored.map((item) => (
                            <SponsoredProductCard
                              key={`sponsored-${item.id}`}
                              item={item}
                              onPress={handleProductPress}
                              badgeText="SPONSORED"
                              badgeColor="#3B82F6"
                            />
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                }
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => load(true, true)}
                    colors={[Brand.primary]}
                    tintColor={Brand.primary}
                  />
                }
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                  loadingMore ? (
                    <ActivityIndicator size="small" color={Brand.primary} style={styles.footer} />
                  ) : !hasMore && products.length > 0 ? (
                    <Text style={styles.endText}>You've reached the end</Text>
                  ) : null
                }
              />
            )}
          </>
        )}
        <ScrollToTopButton visible={showScrollTop} onPress={scrollToTop} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8F9' },
  safeArea: { flex: 1, backgroundColor: '#F7F8F9' },

  // ── Header (modern, always visible, no gradient) ───────────────
  headerWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Brand.surfaceAlt,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F3F4',
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Brand.text,
    paddingVertical: 0,
    height: '100%',
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F3F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: Brand.primary,
  },

  // ── Autocomplete dropdown ───────────────────────────────────────
  autocompleteDropdown: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 4,
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.surfaceAlt,
  },
  autocompleteText: {
    flex: 1,
    fontSize: 14,
    color: Brand.text,
    fontWeight: '500',
  },

  // ── Suggestion bar ("Did you mean") ──────────────────────────────
  suggestionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFBEB',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 10,
  },
  suggestionText: {
    fontSize: 13,
    color: Brand.text,
  },
  suggestionLink: {
    fontWeight: '800',
    color: Brand.primary,
  },
  suggestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: Brand.rating,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  suggestionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // ── Filter toggles row ───────────────────────────────────────────
  filterTogglesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    flexWrap: 'wrap',
  },
  contextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.surfaceAlt,
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.text,
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  contextCount: {
    fontSize: 12,
    color: Brand.textTertiary,
    fontWeight: '600',
  },

  // ── Filter panel ────────────────────────────────────────────────
  filterPanel: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F3F4',
  },
  sortChipActive: {
    backgroundColor: Brand.primary,
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
    backgroundColor: '#F1F3F4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: Brand.text,
  },
  priceDash: {
    color: Brand.textTertiary,
    fontSize: 16,
  },
  applyBtn: {
    backgroundColor: Brand.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  filterFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saleToggleText: {
    fontSize: 14,
    color: Brand.text,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.danger,
  },

  // ── Idle state sections ─────────────────────────────────────────
  idleScroll: { flex: 1 },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Brand.text },
  clearAllText: { fontSize: 12, fontWeight: '700', color: Brand.danger },

  // Recent searches as chips
  recentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Brand.border,
    maxWidth: '100%',
  },
  recentChipText: {
    fontSize: 13,
    color: Brand.text,
    fontWeight: '500',
    flexShrink: 1,
  },

  // Trending as 2-column grid cards
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  trendingCard: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Brand.surfaceAlt,
  },
  trendingImg: {
    width: '100%',
    height: 74,
  },
  trendingImgFallback: {
    backgroundColor: '#E7F5EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  trendingLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.text,
    flex: 1,
  },

  // ── Count bar ───────────────────────────────────────────────────
  countBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  countText: { fontSize: 13, color: Brand.textSecondary, fontWeight: '500', flex: 1 },
  countQuery: { fontWeight: '800', color: Brand.text },
  clearQueryText: { fontSize: 13, fontWeight: '700', color: Brand.primary },

  // ── List ────────────────────────────────────────────────────────
  list: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  row: { gap: 10, marginBottom: 10 },

  // ── Card ────────────────────────────────────────────────────────
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
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
    borderRadius: 6,
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
  price: { fontSize: 15, fontWeight: '800', color: Brand.text },

  // ── Empty state ─────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EDF2F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
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
    borderRadius: 24,
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
    fontSize: 12,
  },

  // ── Sponsored / Pinned sections ─────────────────────────────────
  promoSection: { marginBottom: 12 },
  promoSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 4, marginBottom: 8,
  },
  promoSectionTitle: { fontSize: 13, fontWeight: '700', color: Brand.textSecondary },
  sponsoredCard: {
    width: 140,
    marginRight: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  sponsoredImgWrap: {
    position: 'relative',
    width: '100%',
    height: 120,
    backgroundColor: Brand.surfaceAlt,
  },
  sponsoredImg: { width: '100%', height: '100%' },
  sponsoredBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sponsoredBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '800', letterSpacing: 0.3 },
  sponsoredName: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.text,
    paddingHorizontal: 8,
    paddingTop: 6,
    lineHeight: 16,
  },
  sponsoredPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: Brand.text,
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 2,
  },
});
