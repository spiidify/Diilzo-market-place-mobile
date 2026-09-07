import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiilzoLogo } from '@/components/diilzo-logo';
import { ScrollToTopButton } from '@/components/scroll-to-top';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { fetchCategories, fetchSlides, fetchTopStores } from '@/services/catalog';
import { createChatThread, getChatUnreadCount } from '@/services/chat';
import { fetchProducts } from '@/services/products';
import type { Category, Product, Slide, Store } from '@/types';

// ── Memoized product card for FlatList performance ──────────────────
const ProductCard = memo(function ProductCard({
  item,
  onPress,
  onChat,
}: {
  item: Product;
  onPress: (slug: string) => void;
  onChat: (product: Product) => void;
}) {
  const isSupplier = item.store?.is_wholesaler === true;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(item.slug)}
    >
      <View style={styles.imageWrap}>
        {item.primary_image_url ? (
          <Image
            source={{ uri: item.primary_image_url }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.noImage}>
            <MaterialCommunityIcons name="image-outline" size={40} color={Brand.textTertiary} />
          </View>
        )}
        {item.is_on_sale && (
          <View style={styles.saleBadge}>
            <Text style={styles.saleBadgeText}>{item.discount_percentage}% OFF</Text>
          </View>
        )}
        {isSupplier && (
          <View style={styles.supplierBadge}>
            <MaterialCommunityIcons name="factory" size={9} color="#FFFFFF" />
            <Text style={styles.supplierBadgeText}>Supplier</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.ratingRow}>
          {renderStarsStatic(item.rating)}
          <Text style={styles.reviewCount}>{item.review_count}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.currency}>{item.currency}</Text>
          <Text style={styles.price}>
            {Number(item.final_price).toLocaleString()}
          </Text>
        </View>
        {item.is_on_sale && (
          <Text style={styles.saleText}>
            {item.discount_percentage}% OFF
          </Text>
        )}
        {/* ── Action buttons: different for supplier vs local seller ── */}
        {isSupplier ? (
          <View style={styles.cardActions}>
            <Pressable
              style={({ pressed }) => [styles.inquiryBtn, pressed && styles.inquiryBtnPressed]}
              onPress={(e) => {
                e.stopPropagation();
                onChat(item);
              }}
            >
              <MaterialCommunityIcons name="chat-outline" size={14} color={Brand.primary} />
              <Text style={styles.inquiryBtnText}>Chat Now</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.addToCartBtn, pressed && styles.addToCartPressed]}
              onPress={(e) => {
                e.stopPropagation();
                onPress(item.slug);
              }}
            >
              <MaterialCommunityIcons name="shopping" size={14} color="#FFFFFF" />
              <Text style={styles.addToCartText}>BUY Now</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cardActions}>
            <Pressable
              style={({ pressed }) => [styles.viewBtn, pressed && styles.viewBtnPressed]}
              onPress={(e) => {
                e.stopPropagation();
                onPress(item.slug);
              }}
            >
              <MaterialCommunityIcons name="eye-outline" size={14} color={Brand.primary} />
              <Text style={styles.viewBtnText}>View</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.addToCartBtn, pressed && styles.addToCartPressed]}
              onPress={(e) => {
                e.stopPropagation();
                onPress(item.slug);
              }}
            >
              <MaterialCommunityIcons name="shopping" size={14} color="#FFFFFF" />
              <Text style={styles.addToCartText}>BUY Now</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
});

function renderStarsStatic(rating: string) {
  const value = parseFloat(rating) || 0;
  const full = Math.floor(value);
  const stars: React.ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    stars.push(
      <MaterialCommunityIcons
        key={i}
        name={i < full ? 'star' : 'star-outline'}
        size={12}
        color={Brand.rating}
      />
    );
  }
  return <View style={styles.starsRow}>{stars}</View>;
}

// ── Home Carousel (self-contained, isolated state) ─────────────────
// Extracted so the auto-scroll timer doesn't re-render the parent
// (which was resetting the category ScrollView position).
const HomeCarousel = memo(function HomeCarousel({ slides }: { slides: Slide[] }) {
  const router = useRouter();
  const [activeSlide, setActiveSlide] = useState(0);
  const slideScrollRef = useRef<ScrollView | null>(null);
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (slides.length <= 1) return;
    slideTimerRef.current = setInterval(() => {
      setActiveSlide((prev) => {
        const next = (prev + 1) % slides.length;
        if (slideScrollRef.current) {
          (slideScrollRef.current as any).scrollTo({
            x: next * Dimensions.get('window').width,
            animated: true,
          });
        }
        return next;
      });
    }, 4000);
    return () => {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    };
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <View style={styles.carouselWrap}>
      <ScrollView
        ref={(ref) => { if (ref) { (slideScrollRef as any).current = ref; } }}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (Dimensions.get('window').width - 32));
          if (idx !== activeSlide) setActiveSlide(idx);
        }}
        scrollEventThrottle={16}
      >
        {slides.map((slide) => (
          <Pressable
            key={`slide-${slide.id}`}
            style={styles.slideCard}
            onPress={() => {
              // Priority: category > brand > cta_link
              if (slide.category_slug) {
                router.push({
                  pathname: '/search',
                  params: { category: slide.category_slug, categoryName: slide.category_name || 'Category' },
                } as any);
              } else if (slide.brand_slug) {
                router.push({
                  pathname: '/search',
                  params: { brand: slide.brand_slug, brandName: slide.brand_name || 'Brand' },
                } as any);
              } else if (slide.cta_link) {
                const link = slide.cta_link;
                if (link.startsWith('/')) {
                  router.push(link as any);
                } else {
                  Linking.openURL(link).catch(() => { });
                }
              }
            }}
          >
            {slide.display_image ? (
              <Image
                source={{ uri: slide.display_image }}
                style={styles.slideImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <LinearGradient
                colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.slideFallback}
              />
            )}
          </Pressable>
        ))}
      </ScrollView>
      {slides.length > 1 && (
        <View style={styles.carouselDots}>
          {slides.map((_, i) => (
            <View
              key={`dot-${i}`}
              style={[styles.carouselDot, i === activeSlide && styles.carouselDotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
});

export default function ProductFeedScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(3);
  const { cartCount, refreshCartCount } = useCart();
  const [chatUnread, setChatUnread] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Section data
  const [deals, setDeals] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [topStores, setTopStores] = useState<Store[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);

  // ── Load all sections in parallel ────────────────────────────────
  const loadAllSections = useCallback(async () => {
    try {
      const [dealsRes, newArrRes, featRes, stores, slideData] = await Promise.all([
        fetchProducts({ on_sale: 'true', page: 1 }).catch((e) => { console.error('[Home] deals error:', e?.message); return { results: [] as Product[], next: null }; }),
        fetchProducts({ new_arrival: 'true', page: 1 }).catch((e) => { console.error('[Home] newArr error:', e?.message); return { results: [] as Product[], next: null }; }),
        fetchProducts({ featured: 'true', page: 1 }).catch((e) => { console.error('[Home] feat error:', e?.message); return { results: [] as Product[], next: null }; }),
        fetchTopStores().catch((e) => { console.error('[Home] stores error:', e?.message); return [] as Store[]; }),
        fetchSlides().catch((e) => { console.error('[Home] slides error:', e?.message); return [] as Slide[]; }),
      ]);
      setDeals(dealsRes.results.slice(0, 10));
      setNewArrivals(newArrRes.results.slice(0, 10));
      setRecommended(featRes.results.slice(0, 10));
      setTopStores(stores.slice(0, 10));
      setSlides(slideData);
      console.log('[Home] Slides loaded:', slideData.length, slideData.map(s => s.title));

      // Load recently viewed from local storage
      try {
        const raw = await AsyncStorage.getItem('recently_viewed');
        if (raw) setRecentlyViewed(JSON.parse(raw));
      } catch { }
    } catch (e) {
      // Sections are optional — main grid still loads
    }
  }, []);

  // ── Load categories from API ─────────────────────────────────────
  const loadCategories = useCallback(async () => {
    try {
      const cats = await fetchCategories();
      // Sort by product_count descending so most relevant categories show first
      cats.sort((a, b) => (b.product_count || 0) - (a.product_count || 0));
      setCategories(cats);
    } catch (e) {
      // Categories are optional
    }
  }, []);

  const loadProducts = useCallback(async (reset = false) => {
    const targetPage = reset ? 1 : page;
    if (reset) {
      setPage(1);
      setHasMore(true);
    }
    try {
      if (reset) {
        setRefreshing(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      const params: Record<string, any> = { page: targetPage };
      if (activeCategory) params.category = activeCategory;
      const data = await fetchProducts(params);
      setProducts((prev) => (reset ? data.results : [...prev, ...data.results]));
      setHasMore(data.next !== null);
      if (!reset) setPage(targetPage + 1);
    } catch (e: any) {
      setError(e?.message || 'Failed to load products');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [page, activeCategory]);

  useEffect(() => {
    loadProducts(true);
    loadAllSections();
    loadCategories();
  }, []);

  // ── Refresh cart count and chat unread when screen gains focus ──
  const loadChatUnread = useCallback(async () => {
    if (!isAuthenticated) { setChatUnread(0); return; }
    try {
      const count = await getChatUnreadCount();
      setChatUnread(count);
    } catch {
      setChatUnread(0);
    }
  }, [isAuthenticated]);

  // Refresh cart count every time the home screen gains focus (real-time)
  useFocusEffect(
    useCallback(() => {
      refreshCartCount();
      loadChatUnread();
    }, [refreshCartCount, loadChatUnread])
  );

  // Reload products when category changes
  useEffect(() => {
    if (activeCategory !== null || products.length > 0) {
      loadProducts(true);
    }
  }, [activeCategory]);

  const onRefresh = useCallback(() => {
    loadProducts(true);
    loadAllSections();
    loadCategories();
    refreshCartCount();
  }, [loadProducts, loadAllSections, loadCategories, refreshCartCount]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || refreshing) return;
    loadProducts(false);
  }, [hasMore, loadingMore, refreshing, loadProducts]);

  // ── Scroll tracking + scroll-to-top ─────────────────────────────
  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollTop(offsetY > 300);
  }, []);

  const scrollToTop = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const renderStars = (rating: string) => {
    const value = parseFloat(rating) || 0;
    const full = Math.floor(value);
    const stars: React.ReactNode[] = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <MaterialCommunityIcons
          key={i}
          name={i < full ? 'star' : 'star-outline'}
          size={12}
          color={Brand.rating}
        />
      );
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  // ── Horizontal carousel card (compact) ───────────────────────────
  const renderCarouselCard = (item: Product) => (
    <Pressable
      key={item.id}
      style={({ pressed }) => [styles.carouselCard, pressed && styles.cardPressed]}
      onPress={() => router.push(`/product/${item.slug}`)}
    >
      <View style={styles.carouselImageWrap}>
        {item.primary_image_url ? (
          <Image
            source={{ uri: item.primary_image_url }}
            style={styles.carouselImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.noImage}>
            <MaterialCommunityIcons name="image-outline" size={32} color={Brand.textTertiary} />
          </View>
        )}
        {item.is_on_sale && (
          <View style={styles.saleBadge}>
            <Text style={styles.saleBadgeText}>-{item.discount_percentage}%</Text>
          </View>
        )}
      </View>
      <Text style={styles.carouselName} numberOfLines={2}>{item.name}</Text>
      <View style={styles.carouselPriceRow}>
        <Text style={styles.currency}>{item.currency}</Text>
        <Text style={styles.carouselPrice}>{Number(item.final_price).toLocaleString()}</Text>
      </View>
      {item.is_on_sale && (
        <Text style={styles.carouselOrigPrice}>
          {item.currency} {Number(item.price).toLocaleString()}
        </Text>
      )}
    </Pressable>
  );

  // ── Section header with title + "See all" ────────────────────────
  const renderSectionHeader = (icon: string, title: string, onSeeAll: () => void) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <MaterialCommunityIcons name={icon as any} size={22} color={Brand.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Pressable style={styles.seeAllBtn} onPress={onSeeAll}>
        <Text style={styles.seeAllText}>See all</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={Brand.primary} />
      </Pressable>
    </View>
  );

  // ── Horizontal sliding section ───────────────────────────────────
  const renderSection = (icon: string, title: string, data: Product[], onSeeAll: () => void) => {
    if (!data || data.length === 0) return null;
    return (
      <View style={styles.section}>
        {renderSectionHeader(icon, title, onSeeAll)}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselTrack}
          decelerationRate="fast"
          snapToInterval={160}
          snapToAlignment="start"
        >
          {data.map((item) => renderCarouselCard(item))}
        </ScrollView>
      </View>
    );
  };

  const handleProductPress = useCallback((slug: string) => {
    router.push(`/product/${slug}`);
  }, [router]);

  const handleChat = useCallback(async (product: Product) => {
    try {
      if (!product.store?.slug) return;
      const thread = await createChatThread(product.store.slug, product.id);
      router.push(`/chat/${thread.id}` as any);
    } catch (e: any) {
      console.error('Chat create error:', e?.message);
    }
  }, [router]);

  const renderProduct = useCallback(
    ({ item }: { item: Product }) => (
      <ProductCard item={item} onPress={handleProductPress} onChat={handleChat} />
    ),
    [handleProductPress, handleChat]
  );

  const renderHeader = () => (
    <View>
      {/* Search bar */}
      <Pressable
        style={({ pressed }) => [styles.searchBar, pressed && styles.searchBarPressed]}
        onPress={() => router.push('/search')}
      >
        <MaterialCommunityIcons name="magnify" size={26} color={Brand.textTertiary} />
        <Text style={styles.searchPlaceholder}>Search Diilzo</Text>
        <View style={styles.searchIconRight}>
          <MaterialCommunityIcons name="camera-outline" size={26} color={Brand.primary} />
        </View>
      </Pressable>

      {/* ── Homepage carousel ─────────────────────────────────────── */}
      <HomeCarousel slides={slides} />

      {/* ── Shop by Category — horizontal round carousel ─────────────── */}
      <View style={styles.categoriesSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <MaterialCommunityIcons name="apps" size={20} color={Brand.primary} />
            <Text style={styles.sectionTitle}>Shop by Category</Text>
          </View>
          <Pressable onPress={() => router.push('/categories' as any)}>
            <Text style={styles.seeAllText}>View All ›</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryCarousel}
        >
          {categories.slice(0, 12).map((cat) => (
            <Pressable
              key={`cat-${cat.id}-${cat.slug}`}
              style={({ pressed }) => [styles.categoryItem, pressed && { opacity: 0.8 }]}
              onPress={() => router.push({
                pathname: '/search',
                params: { category: cat.slug, categoryName: cat.name },
              } as any)}
            >
              <View style={styles.categoryCircle}>
                {cat.display_image ? (
                  <Image
                    source={{ uri: cat.display_image }}
                    style={styles.categoryCircleImage}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={styles.categoryCircleFallback}>
                    <MaterialCommunityIcons name="tag" size={26} color="#FFFFFF" />
                  </View>
                )}
              </View>
              <Text style={styles.categoryItemName} numberOfLines={1}>{cat.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── Today's Deals — horizontal sliding carousel ──────────── */}
      {renderSection('fire', "Today's Deals", deals, () => router.push('/search'))}

      {/* ── New Arrivals — horizontal sliding carousel ───────────── */}
      {renderSection('package-variant-closed', 'New Arrivals', newArrivals, () => router.push('/search'))}

      {/* ── Recommended for You — horizontal sliding carousel ────── */}
      {renderSection('thumb-up-outline', 'Recommended for You', recommended, () => router.push('/search'))}

      {/* ── Recently Viewed — from local storage ─────────────────── */}
      {recentlyViewed.length > 0 && renderSection('history', 'Recently Viewed', recentlyViewed, () => { })}

      {/* ── Top Stores — horizontal carousel ──────────────────────── */}
      {topStores.length > 0 && (
        <View style={styles.storesSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="store" size={20} color={Brand.primary} />
              <Text style={styles.sectionTitle}>Top Stores</Text>
            </View>
            <Pressable onPress={() => router.push('/suppliers')}>
              <Text style={styles.seeAllText}>View All ›</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.storesCarousel}
          >
            {topStores.map((s) => (
              <Pressable
                key={s.id}
                style={styles.storeCard}
                onPress={() => router.push(`/store/${s.slug}` as any)}
              >
                <View style={styles.storeLogoWrap}>
                  {s.logo_url ? (
                    <Image source={{ uri: s.logo_url }} style={styles.storeLogo} contentFit="cover" />
                  ) : (
                    <View style={styles.storeLogoFallback}>
                      <MaterialCommunityIcons name={s.is_wholesaler ? 'factory' : 'store'} size={24} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <Text style={styles.storeName} numberOfLines={1}>{s.name}</Text>
                <Text style={styles.storeLocation} numberOfLines={1}>{s.city}, {s.country}</Text>
                <View style={styles.storeMetaRow}>
                  <MaterialCommunityIcons name="package-variant-closed" size={11} color={Brand.textSecondary} />
                  <Text style={styles.storeMetaText}>{s.product_count || 0} products</Text>
                </View>
                {s.is_wholesaler && (
                  <View style={styles.storeWholesaleBadge}>
                    <MaterialCommunityIcons name="shield-check" size={10} color="#FFFFFF" />
                    <Text style={styles.storeWholesaleText}>Supplier</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Supplier banner ──────────────────────────────────────── */}
      <Pressable
        style={({ pressed }) => [styles.supplierBanner, pressed && { opacity: 0.9 }]}
        onPress={() => router.push('/suppliers')}
      >
        <View style={styles.supplierBannerContent}>
          <View style={styles.supplierBannerIcon}>
            <MaterialCommunityIcons name="factory" size={32} color="#FFFFFF" />
          </View>
          <View style={styles.supplierBannerText}>
            <Text style={styles.supplierBannerTitle}>Source from Manufacturers</Text>
            <Text style={styles.supplierBannerSub}>
              Verified suppliers • Trade Assurance • Factory prices
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#FFFFFF" />
        </View>
      </Pressable>

      {/* ── Category-filtered section title ──────────────────────── */}
      {activeCategory ? (
        <View style={styles.allProductsHeader}>
          <MaterialCommunityIcons name="view-grid" size={22} color={Brand.primary} />
          <Text style={styles.allProductsTitle}>
            {categories.find((c) => c.slug === activeCategory)?.name || 'Products'}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (loading && products.length === 0) {
    return (
      <View style={styles.screen}>
        <LinearGradient colors={[Brand.primary, Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBg}>
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <LinearGradient colors={['transparent', 'transparent']} style={styles.header}>
              <DiilzoLogo size={36} />
              <Pressable
                style={({ pressed }) => [styles.cartIcon, pressed && styles.iconPressed]}
                onPress={() => router.push('/cart')}
              >
                <MaterialCommunityIcons name="cart-outline" size={26} color="#FFFFFF" />
                {cartCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.chatIcon, pressed && styles.iconPressed]}
                onPress={() => router.push('/chat' as any)}
              >
                <MaterialCommunityIcons name="chat-outline" size={24} color="#FFFFFF" />
                {chatUnread > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{chatUnread > 9 ? '9+' : chatUnread}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.notifBtn, pressed && styles.iconPressed]}
                onPress={() => router.push('/account')}
              >
                <MaterialCommunityIcons name="bell" size={24} color="#FFFFFF" />
                {notificationCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable onPress={() => router.push('/account')} style={styles.profileBtn}>
                <Text style={styles.userName} numberOfLines={1}>
                  {isAuthenticated ? (user?.first_name || user?.full_name?.split(' ')[0] || 'Account') : 'Sign in'}
                </Text>
                {isAuthenticated && user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <MaterialCommunityIcons name="account" size={20} color="#FFFFFF" />
                  </View>
                )}
              </Pressable>
            </LinearGradient>
          </SafeAreaView>
        </LinearGradient>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Brand.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (error && products.length === 0) {
    return (
      <View style={styles.screen}>
        <LinearGradient colors={[Brand.primary, Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBg}>
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <LinearGradient colors={['transparent', 'transparent']} style={styles.header}>
              <DiilzoLogo size={36} />
              <Pressable
                style={({ pressed }) => [styles.cartIcon, pressed && styles.iconPressed]}
                onPress={() => router.push('/cart')}
              >
                <MaterialCommunityIcons name="cart-outline" size={26} color="#FFFFFF" />
                {cartCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.chatIcon, pressed && styles.iconPressed]}
                onPress={() => router.push('/chat' as any)}
              >
                <MaterialCommunityIcons name="chat-outline" size={24} color="#FFFFFF" />
                {chatUnread > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{chatUnread > 9 ? '9+' : chatUnread}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.notifBtn, pressed && styles.iconPressed]}
                onPress={() => router.push('/account')}
              >
                <MaterialCommunityIcons name="bell" size={24} color="#FFFFFF" />
                {notificationCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable onPress={() => router.push('/account')} style={styles.profileBtn}>
                <Text style={styles.userName} numberOfLines={1}>
                  {isAuthenticated ? (user?.first_name || user?.full_name?.split(' ')[0] || 'Account') : 'Sign in'}
                </Text>
                {isAuthenticated && user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <MaterialCommunityIcons name="account" size={20} color="#FFFFFF" />
                  </View>
                )}
              </Pressable>
            </LinearGradient>
          </SafeAreaView>
        </LinearGradient>
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => loadProducts(true)}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={[Brand.primary, Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBg}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <LinearGradient colors={['transparent', 'transparent']} style={styles.header}>
            {/* Logo on left */}
            <DiilzoLogo size={36} />
            {/* Cart icon — pushed to the right */}
            <Pressable
              style={({ pressed }) => [styles.cartIcon, pressed && styles.iconPressed]}
              onPress={() => router.push('/cart')}
            >
              <MaterialCommunityIcons name="cart-outline" size={26} color="#FFFFFF" />
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                </View>
              )}
            </Pressable>
            {/* Chat icon with unread badge */}
            <Pressable
              style={({ pressed }) => [styles.chatIcon, pressed && styles.iconPressed]}
              onPress={() => router.push('/chat' as any)}
            >
              <MaterialCommunityIcons name="chat-outline" size={24} color="#FFFFFF" />
              {chatUnread > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{chatUnread > 9 ? '9+' : chatUnread}</Text>
                </View>
              )}
            </Pressable>
            {/* Notification bell with count badge */}
            <Pressable
              style={({ pressed }) => [styles.notifBtn, pressed && styles.iconPressed]}
              onPress={() => router.push('/account')}
            >
              <MaterialCommunityIcons name="bell" size={24} color="#FFFFFF" />
              {notificationCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
                </View>
              )}
            </Pressable>
            {/* User name + profile picture on the far right */}
            <Pressable onPress={() => router.push('/account')} style={styles.profileBtn}>
              <Text style={styles.userName} numberOfLines={1}>
                {isAuthenticated ? (user?.first_name || user?.full_name?.split(' ')[0] || 'Account') : 'Sign in'}
              </Text>
              {isAuthenticated && user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <MaterialCommunityIcons name="account" size={20} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
          </LinearGradient>
        </SafeAreaView>
      </LinearGradient>

      <FlatList
        ref={flatListRef}
        data={products}
        keyExtractor={(item, index) => `${item.id}-${item.slug}-${index}`}
        renderItem={renderProduct}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListHeaderComponent={renderHeader}
        maxToRenderPerBatch={6}
        windowSize={7}
        initialNumToRender={8}
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
            <Text style={styles.endText}>No more products</Text>
          ) : null
        }
      />

      {/* ── Floating scroll-to-top button ──────────────────────── */}
      <ScrollToTopButton visible={showScrollTop} onPress={scrollToTop} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 0, backgroundColor: 'transparent' },
  headerBg: {
    width: '100%',
    borderBottomWidth: 3,
    borderBottomColor: Brand.primary,
  },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  logo: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  logoWrap: {
    gap: 0,
  },
  logoSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: -2,
  },
  cartIcon: {
    padding: Spacing.one + 2,
    marginLeft: 'auto',
    position: 'relative',
  },
  chatIcon: {
    padding: Spacing.one + 2,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: -2,
    backgroundColor: '#FFFFFF',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Brand.primary,
  },
  cartBadgeText: {
    color: Brand.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  notifBtn: {
    padding: Spacing.one + 2,
    marginLeft: Spacing.one,
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    backgroundColor: Brand.danger,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Brand.primary,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginLeft: Spacing.two,
    maxWidth: 140,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Brand.darkLight,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPressed: { opacity: 0.6 },

  // ── Search bar ──────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.border,
    marginHorizontal: Spacing.two,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  searchBarPressed: { opacity: 0.85 },
  searchPlaceholder: {
    flex: 1,
    color: Brand.textTertiary,
    fontSize: 14,
  },
  searchIconRight: {
    borderLeftWidth: 1,
    borderLeftColor: Brand.borderLight,
    paddingLeft: Spacing.two,
  },

  // ── Homepage carousel ───────────────────────────────────────────
  carouselWrap: {
    marginHorizontal: Spacing.two,
    marginVertical: Spacing.two,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  slideCard: {
    width: Dimensions.get('window').width - 32,
    height: 220,
    position: 'relative',
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  slideFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  carouselDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Brand.border,
  },
  carouselDotActive: {
    width: 22,
    height: 7,
    borderRadius: 4,
    backgroundColor: Brand.primary,
  },

  // ── Category chips ──────────────────────────────────────────────
  chipsRow: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    backgroundColor: '#FFFFFF',
    marginHorizontal: Spacing.two,
    marginVertical: Spacing.one,
    borderRadius: 12,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  chipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: Brand.border,
  },
  chipPressed: { opacity: 0.8 },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: { color: '#FFFFFF' },
  chipTextInactive: { color: Brand.textSecondary },

  // ── Horizontal sliding sections ─────────────────────────────────
  section: {
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: Spacing.two,
    marginHorizontal: Spacing.two,
    elevation: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.two,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.text,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.primary,
  },

  carouselTrack: {
    paddingHorizontal: Spacing.two,
    gap: Spacing.two,
  },
  carouselCard: {
    width: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  carouselImageWrap: {
    width: '100%',
    height: 150,
    backgroundColor: Brand.surfaceAlt,
    position: 'relative',
  },
  carouselImage: { width: '100%', height: '100%' },
  carouselName: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.text,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
    lineHeight: 16,
    height: 32,
  },
  carouselPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    paddingHorizontal: Spacing.two,
    paddingBottom: 2,
  },
  carouselPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
  },
  carouselOrigPrice: {
    fontSize: 11,
    color: Brand.textTertiary,
    textDecorationLine: 'line-through',
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
  },

  // ── All Products header ─────────────────────────────────────────
  allProductsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
    marginHorizontal: 0,
    backgroundColor: Brand.surfaceAlt,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: Brand.primary,
  },
  allProductsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.text,
  },

  // ── Shop by Category — round horizontal carousel ────────────────
  categoriesSection: {
    backgroundColor: '#FFFFFF',
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
    marginHorizontal: Spacing.two,
    borderRadius: 16,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  categoryCarousel: {
    paddingHorizontal: 4,
    gap: 14,
  },
  categoryItem: {
    alignItems: 'center',
    width: 76,
  },
  categoryCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Brand.surfaceAlt,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  categoryCircleImage: {
    width: '100%',
    height: '100%',
  },
  categoryCircleFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryItemName: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: Brand.textSecondary,
    textAlign: 'center',
  },

  // ── Top Stores section ──────────────────────────────────────────
  storesSection: {
    backgroundColor: '#FFFFFF',
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
    marginHorizontal: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  storesCarousel: { paddingHorizontal: Spacing.three, gap: 12 },
  storeCard: {
    width: 120,
    backgroundColor: Brand.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Brand.surfaceAlt,
  },
  storeLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: Brand.primary,
    marginBottom: 4,
  },
  storeLogo: { width: '100%', height: '100%' },
  storeLogoFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  storeName: { fontSize: 13, fontWeight: '700', color: Brand.text, textAlign: 'center' },
  storeLocation: { fontSize: 11, color: Brand.textSecondary, textAlign: 'center' },
  storeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  storeMetaText: { fontSize: 11, color: Brand.textSecondary },
  storeWholesaleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Brand.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  storeWholesaleText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },

  // ── Supplier banner ─────────────────────────────────────────────
  supplierBanner: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Brand.primary,
  },
  supplierBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  supplierBannerIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supplierBannerText: { flex: 1, gap: 2 },
  supplierBannerTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  supplierBannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },

  // ── Product grid ────────────────────────────────────────────────
  list: { paddingHorizontal: Spacing.two, paddingBottom: Spacing.six },
  row: { gap: Spacing.two, marginBottom: Spacing.two },

  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },

  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Brand.surfaceAlt,
    position: 'relative',
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
    top: Spacing.one,
    left: Spacing.one,
    backgroundColor: Brand.danger,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 4,
  },
  saleBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },

  cardBody: {
    padding: Spacing.two,
    gap: Spacing.one,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.text,
    lineHeight: 17,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 1,
  },
  reviewCount: {
    fontSize: 11,
    color: Brand.link,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginTop: 2,
  },
  currency: {
    fontSize: 11,
    color: Brand.text,
    fontWeight: '600',
  },
  price: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.text,
  },
  saleText: {
    color: Brand.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  // ── Card action buttons ─────────────────────────────────────────
  cardActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: Spacing.one,
  },
  addToCartBtn: {
    flex: 1,
    backgroundColor: Brand.primary,
    borderRadius: 20,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: Brand.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addToCartPressed: { backgroundColor: Brand.primaryDark, transform: [{ scale: 0.96 }] },
  addToCartText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  inquiryBtn: {
    flex: 1,
    backgroundColor: Brand.surfaceAlt,
    borderRadius: 6,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Brand.primary,
  },
  inquiryBtnPressed: { backgroundColor: Brand.border },
  inquiryBtnText: {
    color: Brand.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  viewBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 20,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: Brand.primary,
  },
  viewBtnPressed: { backgroundColor: Brand.surfaceAlt, transform: [{ scale: 0.96 }] },
  viewBtnText: {
    color: Brand.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  supplierBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F97316',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  supplierBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },

  // ── States ──────────────────────────────────────────────────────
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  loadingText: {
    marginTop: Spacing.two,
    color: Brand.textSecondary,
    fontSize: 14,
  },
  errorTitle: {
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
    fontSize: 18,
    fontWeight: '700',
    color: Brand.danger,
  },
  errorMsg: {
    textAlign: 'center',
    color: Brand.textSecondary,
    fontSize: 13,
    marginBottom: Spacing.three,
  },
  retryBtn: {
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  footer: { paddingVertical: Spacing.three },
  endText: {
    textAlign: 'center',
    paddingVertical: Spacing.three,
    color: Brand.textTertiary,
    fontSize: 12,
  },
});
