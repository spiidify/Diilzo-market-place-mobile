import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScrollToTopButton } from '@/components/scroll-to-top';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useImageDimensions } from '@/hooks/useImageDimensions';
import { fetchCategories } from '@/services/catalog';
import { fetchProducts } from '@/services/products';
import type { Category, Product } from '@/types';

const LEFT_PANEL_WIDTH = 100;

export default function CategoriesScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const leftListRef = useRef<FlatList>(null);
  const rightScrollRef = useRef<ScrollView>(null);
  const productCardSize = useImageDimensions('productCard');
  const categorySize = useImageDimensions('category');
  const selectedSlugRef = useRef<string | null>(null);

  // Subcategory card width — responsive to actual screen width
  const subGridPadding = 20;
  const subGridGap = 10;
  const subColumns = 3;
  const subCardWidth = Math.floor(
    (screenWidth - LEFT_PANEL_WIDTH - subGridPadding - subGridGap * (subColumns - 1)) / subColumns
  );

  // Filter categories by search query
  const filteredCategories = searchQuery.trim()
    ? categories.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.children || []).some((ch) => ch.name.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    : categories;

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const cats = await fetchCategories(categorySize);
      setCategories(cats);
      if (cats.length > 0 && !selectedSlugRef.current) {
        selectedSlugRef.current = cats[0].slug;
        setSelectedSlug(cats[0].slug);
      }
    } catch (e: any) {
      console.error('Categories load error:', e?.message);
      setLoadError(e?.message || 'Failed to load categories');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categorySize]);

  useEffect(() => {
    load();
  }, [load]);

  // Look up selected category from the FULL list (not filtered) so the
  // right panel doesn't go blank when search hides the selected parent.
  const selectedCategory = categories.find((c) => c.slug === selectedSlug) || null;

  // Fetch products for the selected parent category
  useEffect(() => {
    if (!selectedSlug) {
      setCategoryProducts([]);
      return;
    }
    setProductsLoading(true);
    fetchProducts({ category: selectedSlug, page: 1, ...productCardSize })
      .then((data) => setCategoryProducts(data.results || []))
      .catch((e) => {
        console.error('[Categories] products error:', e?.message);
        setCategoryProducts([]);
      })
      .finally(() => setProductsLoading(false));
  }, [selectedSlug, productCardSize]);

  const handleCategoryPress = useCallback((cat: Category) => {
    router.push({
      pathname: '/search',
      params: { category: cat.slug, categoryName: cat.name },
    } as any);
  }, [router]);

  const handleScroll = useCallback((event: any) => {
    setShowScrollTop(event.nativeEvent.contentOffset.y > 300);
  }, []);

  const scrollToTop = useCallback(() => {
    rightScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // Reset right panel scroll when switching parent
  const handleParentSelect = useCallback((slug: string) => {
    selectedSlugRef.current = slug;
    setSelectedSlug(slug);
    rightScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  // ── Left panel: parent categories ──────────────────────────────
  const renderParent = useCallback(
    ({ item }: { item: Category }) => {
      const active = item.slug === selectedSlug;
      return (
        <Pressable
          style={({ pressed }) => [styles.parentItem, active && styles.parentItemActive, pressed && { opacity: 0.85 }]}
          onPress={() => handleParentSelect(item.slug)}
        >
          {active && <View style={styles.activeBar} />}
          <View style={[styles.parentCircle, active && styles.parentCircleActive]}>
            {item.display_image ? (
              <Image source={{ uri: item.display_image }} style={styles.parentCircleImg} resizeMode="contain" />
            ) : (
              <View style={styles.parentCircleFallback}>
                <MaterialCommunityIcons name="tag" size={18} color="#FFFFFF" />
              </View>
            )}
          </View>
          <Text
            style={[styles.parentName, active && styles.parentNameActive]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
        </Pressable>
      );
    },
    [selectedSlug, handleParentSelect]
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <LinearGradient colors={[Brand.dark, Brand.accent, Brand.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
            <Text style={styles.headerTitle}>Categories</Text>
            <Text style={styles.headerSub}>Browse all product categories</Text>
          </LinearGradient>
        </SafeAreaView>
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
          <Text style={styles.loadingText}>Loading categories...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header — SafeAreaView only wraps the header */}
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LinearGradient colors={[Brand.dark, Brand.accent, Brand.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          {/* Title row with profile on the right */}
          <View style={styles.titleRow}>
            <View style={styles.titleTextWrap}>
              <Text style={styles.headerTitle}>Categories</Text>
              <Text style={styles.headerSub}>Browse all product categories</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.profileBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/buyer' as any)}
            >
              {isAuthenticated && user ? (
                <View style={styles.avatarWrap}>
                  {user.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={styles.avatar} resizeMode="cover" />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitial}>
                        {(user.first_name || user.email || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.avatarWrap}>
                  <View style={styles.avatarFallback}>
                    <MaterialCommunityIcons name="account" size={20} color="#FFFFFF" />
                  </View>
                </View>
              )}
            </Pressable>
          </View>
          {/* Search bar */}
          <View style={styles.searchBar}>
            <MaterialCommunityIcons name="magnify" size={20} color="rgba(255,255,255,0.7)" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search categories..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle" size={18} color="rgba(255,255,255,0.7)" />
              </Pressable>
            )}
          </View>
        </LinearGradient>
      </SafeAreaView>

      {/* Body: left menu + right content — direct child of screen, fills remaining space */}
      <View style={styles.body}>
        {loadError ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorText}>{loadError}</Text>
            <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : categories.length === 0 ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="package-variant-closed" size={48} color={Brand.textTertiary} />
            <Text style={styles.emptyText}>No categories found</Text>
            <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
              <Text style={styles.retryBtnText}>Reload</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Left panel — parent categories */}
            <View style={styles.leftPanel}>
              <FlatList
                data={filteredCategories}
                keyExtractor={(item) => `parent-${item.id}-${item.slug}`}
                renderItem={renderParent}
                contentContainerStyle={styles.parentList}
                showsVerticalScrollIndicator={false}
                maxToRenderPerBatch={10}
                windowSize={11}
                initialNumToRender={10}
                removeClippedSubviews={true}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => { setRefreshing(true); load(); }}
                    colors={[Brand.primary]}
                    tintColor={Brand.primary}
                  />
                }
              />
            </View>

            {/* Right panel — modern children view */}
            <ScrollView
              ref={rightScrollRef}
              style={styles.rightPanel}
              contentContainerStyle={styles.rightContent}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {selectedCategory && (
                <>
                  {/* Category hero banner */}
                  <View style={styles.heroBanner}>
                    {selectedCategory.display_image ? (
                      <Image
                        source={{ uri: selectedCategory.display_image }}
                        style={styles.heroBg}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={[styles.heroBg, styles.heroBgFallback]} />
                    )}
                    <View style={styles.heroOverlay} />
                    <View style={styles.heroContent}>
                      <Text style={styles.heroTitle}>{selectedCategory.name}</Text>
                      <Text style={styles.heroCount}>
                        {(selectedCategory.children || []).length} subcategories
                      </Text>
                    </View>
                  </View>

                  {/* Browse all button — pill style */}
                  <Pressable
                    style={({ pressed }) => [styles.browseAllPill, pressed && { opacity: 0.88 }]}
                    onPress={() => handleCategoryPress(selectedCategory)}
                  >
                    <MaterialCommunityIcons name="view-grid" size={18} color="#FFFFFF" />
                    <Text style={styles.browseAllText}>Browse all {selectedCategory.name}</Text>
                    <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
                  </Pressable>

                  {/* Subcategories — modern card grid */}
                  {selectedCategory.children && selectedCategory.children.length > 0 ? (
                    <View style={styles.subGrid}>
                      {selectedCategory.children.map((child) => (
                        <Pressable
                          key={`sub-${child.id}-${child.slug}`}
                          style={({ pressed }) => [styles.subCard, { width: subCardWidth }, pressed && { opacity: 0.85 }]}
                          onPress={() => handleCategoryPress(child)}
                        >
                          <View style={styles.subCardIcon}>
                            {child.display_image ? (
                              <Image
                                source={{ uri: child.display_image }}
                                style={styles.subCardImg}
                                resizeMode="contain"
                              />
                            ) : (
                              <View style={styles.subCardFallback}>
                                <MaterialCommunityIcons name="tag" size={22} color="#FFFFFF" />
                              </View>
                            )}
                          </View>
                          <Text style={styles.subCardName} numberOfLines={2}>{child.name}</Text>
                          {child.product_count !== undefined && child.product_count > 0 && (
                            <Text style={styles.subCardCount}>{child.product_count} items</Text>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptySubs}>
                      <MaterialCommunityIcons name="package-variant-closed" size={44} color={Brand.textTertiary} />
                      <Text style={styles.emptySubsText}>No subcategories yet</Text>
                      <Pressable
                        style={({ pressed }) => [styles.browseBtn, pressed && { opacity: 0.85 }]}
                        onPress={() => handleCategoryPress(selectedCategory)}
                      >
                        <Text style={styles.browseBtnText}>Browse {selectedCategory.name}</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Products from this category — 2 per row */}
                  {categoryProducts.length > 0 && (
                    <View style={styles.productsSection}>
                      <Text style={styles.productsSectionTitle}>Products in {selectedCategory.name}</Text>
                      <View style={styles.productGrid}>
                        {categoryProducts.map((item) => (
                          <Pressable
                            key={`cat-prod-${item.id}-${item.slug}`}
                            style={({ pressed }) => [styles.productCard, pressed && { opacity: 0.9 }]}
                            onPress={() => router.push(`/product/${item.slug}` as any)}
                          >
                            <View style={styles.productImageWrap}>
                              {item.primary_image_url ? (
                                <Image
                                  source={{ uri: item.primary_image_url }}
                                  style={styles.productImage}
                                  resizeMode="contain"
                                />
                              ) : (
                                <View style={styles.productNoImage}>
                                  <MaterialCommunityIcons name="image-outline" size={32} color={Brand.textTertiary} />
                                </View>
                              )}
                              {item.is_on_sale && (
                                <View style={styles.productSaleBadge}>
                                  <Text style={styles.productSaleBadgeText}>{item.discount_percentage}% OFF</Text>
                                </View>
                              )}
                            </View>
                            <View style={styles.productCardBody}>
                              <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                              <View style={styles.productPriceRow}>
                                <Text style={styles.productCurrency}>{item.currency}</Text>
                                <Text style={styles.productPrice}>
                                  {Number(item.final_price).toLocaleString()}
                                </Text>
                              </View>
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                  {productsLoading && (
                    <View style={styles.productsLoading}>
                      <ActivityIndicator size="small" color={Brand.primary} />
                      <Text style={styles.productsLoadingText}>Loading products...</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </>
        )}
      </View>
      <ScrollToTopButton visible={showScrollTop} onPress={scrollToTop} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F2F4F6' },
  safeArea: { backgroundColor: Brand.dark },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  // Title row with profile on the right
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  titleTextWrap: {
    flex: 1,
  },
  profileBtn: {
    padding: 2,
    flexShrink: 0,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    padding: 1.5,
  },
  avatar: { width: '100%', height: '100%', borderRadius: 17 },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  headerTitle: { fontSize: 21, fontWeight: '900', color: '#FFFFFF' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    padding: 0,
  },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F4F6', gap: 10 },
  loadingText: { marginTop: 8, color: Brand.primary, fontSize: 14 },
  errorText: { fontSize: 14, color: Brand.danger, textAlign: 'center', paddingHorizontal: 20 },
  emptyText: { fontSize: 14, color: Brand.textTertiary },
  retryBtn: {
    marginTop: 8,
    backgroundColor: Brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // ── Body split layout ──────────────────────────────────────────
  body: { flex: 1, flexDirection: 'row' },

  // ── Left panel ─────────────────────────────────────────────────
  leftPanel: {
    width: 100,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E8EDF0',
  },
  parentList: { paddingVertical: 4, paddingHorizontal: 4 },
  parentItem: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    width: '100%',
    borderRadius: 12,
  },
  parentItemActive: {
    backgroundColor: Brand.primary + '0A',
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 3,
    backgroundColor: Brand.primary,
  },
  parentCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E8EDF0',
  },
  parentCircleActive: {
    borderColor: Brand.primary,
    borderWidth: 2.5,
  },
  parentCircleImg: { width: '100%', height: '100%' },
  parentCircleFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  parentName: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: '600',
    color: Brand.textSecondary,
    textAlign: 'center',
    lineHeight: 13,
  },
  parentNameActive: {
    color: Brand.primary,
    fontWeight: '800',
  },

  // ── Right panel ────────────────────────────────────────────────
  rightPanel: {
    flex: 1,
    backgroundColor: '#F2F4F6',
  },
  rightContent: { paddingBottom: 24 },

  // ── Hero banner ───────────────────────────────────────────────
  heroBanner: {
    height: 110,
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 14,
    position: 'relative',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  heroBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  heroBgFallback: {
    backgroundColor: Brand.primary,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
    fontWeight: '600',
  },

  // ── Browse all pill button ─────────────────────────────────────
  browseAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 10,
    marginTop: 10,
    marginBottom: 14,
    backgroundColor: Brand.primary,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 3,
    shadowColor: Brand.primary,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  browseAllText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },

  // ── Subcategory list — 3 per row ───────────────────────────────
  subGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    gap: 10,
  },
  subCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EDF0',
  },
  subCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EDF0',
    marginBottom: 6,
  },
  subCardImg: { width: '100%', height: '100%' },
  subCardFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subCardName: {
    fontSize: 9.5,
    fontWeight: '600',
    color: Brand.textSecondary,
    textAlign: 'center',
    lineHeight: 11,
  },
  subCardCount: {
    fontSize: 8,
    color: Brand.textTertiary,
    marginTop: 1,
  },

  // Empty state
  emptySubs: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptySubsText: { fontSize: 14, color: Brand.textTertiary },
  browseBtn: {
    marginTop: 8,
    backgroundColor: Brand.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  browseBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // ── Category products — 2 per row ──────────────────────────────
  productsSection: {
    marginTop: 18,
    paddingHorizontal: 10,
  },
  productsSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.text,
    marginBottom: 10,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  productCard: {
    width: '48%',
    flex: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EDF0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  productImageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F8FAFB',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productNoImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productSaleBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: Brand.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  productSaleBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  productCardBody: {
    padding: 8,
    gap: 4,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.text,
    lineHeight: 15,
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  productCurrency: {
    fontSize: 10,
    color: Brand.text,
    fontWeight: '600',
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
  },
  productsLoading: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  productsLoadingText: {
    fontSize: 13,
    color: Brand.textTertiary,
  },
});
