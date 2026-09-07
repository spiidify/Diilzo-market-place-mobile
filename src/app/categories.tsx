import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
import { useAuth } from '@/context/AuthContext';
import { useImageDimensions } from '@/hooks/useImageDimensions';
import { fetchCategories } from '@/services/catalog';
import { fetchProducts } from '@/services/products';
import type { Category, Product } from '@/types';

// Right panel = screen width - left panel (100) - padding
const SCREEN_WIDTH = Dimensions.get('window').width;
const LEFT_PANEL_WIDTH = 100;
const SUB_GRID_PADDING = 24; // 12px each side
const SUB_GRID_GAP = 10;
const SUB_COLUMNS = 3;
const SUB_CARD_WIDTH = Math.floor(
  (SCREEN_WIDTH - LEFT_PANEL_WIDTH - SUB_GRID_PADDING - SUB_GRID_GAP * (SUB_COLUMNS - 1)) / SUB_COLUMNS
);

export default function CategoriesScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const leftListRef = useRef<FlatList>(null);
  const rightScrollRef = useRef<ScrollView>(null);
  const productCardSize = useImageDimensions('productCard');

  // Filter categories by search query
  const filteredCategories = searchQuery.trim()
    ? categories.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.children || []).some((ch) => ch.name.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    : categories;

  const load = useCallback(async () => {
    try {
      const cats = await fetchCategories();
      setCategories(cats);
      if (cats.length > 0 && !selectedSlug) {
        setSelectedSlug(cats[0].slug);
      }
    } catch (e: any) {
      console.error('Categories load error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedCategory = filteredCategories.find((c) => c.slug === selectedSlug) || null;

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

  const handleCategoryPress = (cat: Category) => {
    router.push({
      pathname: '/search',
      params: { category: cat.slug, categoryName: cat.name },
    } as any);
  };

  const handleScroll = useCallback((event: any) => {
    setShowScrollTop(event.nativeEvent.contentOffset.y > 300);
  }, []);

  const scrollToTop = useCallback(() => {
    rightScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // Reset right panel scroll when switching parent
  const handleParentSelect = (slug: string) => {
    setSelectedSlug(slug);
    rightScrollRef.current?.scrollTo({ y: 0, animated: false });
  };

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
              <Image source={{ uri: item.display_image }} style={styles.parentCircleImg} contentFit="contain" transition={150} />
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
    [selectedSlug]
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Categories</Text>
            <Text style={styles.headerSub}>Browse all product categories</Text>
          </View>
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading categories...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header with profile + search */}
        <View style={styles.header}>
          {/* Title row with profile on the right */}
          <View style={styles.titleRow}>
            <View>
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
                    <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="contain" />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitial}>
                        {(user.first_name || user.email || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.avatarFallback}>
                  <MaterialCommunityIcons name="account" size={20} color="#FFFFFF" />
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
        </View>

        {/* Body: left menu + right content */}
        <View style={styles.body}>
          {/* Left panel — parent categories */}
          <View style={styles.leftPanel}>
            <FlatList
              data={filteredCategories}
              keyExtractor={(item, index) => `parent-${item.id}-${item.slug}-${index}`}
              renderItem={renderParent}
              contentContainerStyle={styles.parentList}
              showsVerticalScrollIndicator={false}
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
                      contentFit="contain"
                      transition={200}
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
                        style={({ pressed }) => [styles.subCard, pressed && { opacity: 0.85 }]}
                        onPress={() => handleCategoryPress(child)}
                      >
                        <View style={styles.subCardIcon}>
                          {child.display_image ? (
                            <Image
                              source={{ uri: child.display_image }}
                              style={styles.subCardImg}
                              contentFit="contain"
                              transition={150}
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
                                contentFit="contain"
                                transition={200}
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
        </View>
        <ScrollToTopButton visible={showScrollTop} onPress={scrollToTop} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Brand.primary,
  },
  // Title row with profile on the right
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  profileBtn: {
    padding: 2,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    padding: 0,
  },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  loadingText: { marginTop: 8, color: Brand.primary, fontSize: 14 },

  // ── Body split layout ──────────────────────────────────────────
  body: { flex: 1, flexDirection: 'row' },

  // ── Left panel ─────────────────────────────────────────────────
  leftPanel: {
    width: 100,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: Brand.surfaceAlt,
  },
  parentList: { paddingVertical: 4, paddingHorizontal: 4 },
  parentItem: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    width: '100%',
  },
  parentItemActive: {
    backgroundColor: Brand.surfaceAlt,
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
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
    borderColor: Brand.border,
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
    backgroundColor: '#FAFAFA',
  },
  rightContent: { paddingBottom: 24 },

  // ── Hero banner (replaces the old selectedHeader) ──────────────
  heroBanner: {
    height: 120,
    position: 'relative',
    overflow: 'hidden',
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
    padding: 16,
  },
  heroTitle: {
    fontSize: 22,
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
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 16,
    backgroundColor: Brand.primary,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: Brand.primary,
    shadowOpacity: 0.3,
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
    paddingHorizontal: 12,
    gap: 10,
  },
  subCard: {
    width: SUB_CARD_WIDTH,
    backgroundColor: '#F5F9F7',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8F0EC',
  },
  subCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Brand.border,
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
    marginTop: 20,
    paddingHorizontal: 12,
  },
  productsSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.text,
    marginBottom: 12,
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
    borderColor: Brand.surfaceAlt,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  productImageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Brand.surfaceAlt,
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
