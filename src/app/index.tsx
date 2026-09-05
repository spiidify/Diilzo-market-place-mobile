import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { addToCart, getCartCount } from '@/services/cart';
import { fetchCategories, fetchTopStores } from '@/services/catalog';
import { createChatThread, getChatUnreadCount } from '@/services/chat';
import { fetchProducts } from '@/services/products';
import type { Category, Product, Store } from '@/types';

// ── Memoized product card for FlatList performance ──────────────────
const ProductCard = memo(function ProductCard({
  item,
  onPress,
  onAddToCart,
  onChat,
}: {
  item: Product;
  onPress: (slug: string) => void;
  onAddToCart: (product: Product) => void;
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
                onAddToCart(item);
              }}
            >
              <MaterialCommunityIcons name="plus" size={14} color="#FFFFFF" />
              <Text style={styles.addToCartText}>Add to cart</Text>
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
              <MaterialCommunityIcons name="eye-outline" size={14} color="#6B7280" />
              <Text style={styles.viewBtnText}>View</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.addToCartBtn, pressed && styles.addToCartPressed]}
              onPress={(e) => {
                e.stopPropagation();
                onAddToCart(item);
              }}
            >
              <MaterialCommunityIcons name="plus" size={14} color="#FFFFFF" />
              <Text style={styles.addToCartText}>Add to cart</Text>
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
  const [cartCount, setCartCount] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);

  // Section data
  const [deals, setDeals] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [topStores, setTopStores] = useState<Store[]>([]);

  // ── Load all sections in parallel ────────────────────────────────
  const loadAllSections = useCallback(async () => {
    try {
      const [dealsRes, newArrRes, featRes, stores] = await Promise.all([
        fetchProducts({ on_sale: 'true', page: 1 }).catch(() => ({ results: [] as Product[], next: null })),
        fetchProducts({ new_arrival: 'true', page: 1 }).catch(() => ({ results: [] as Product[], next: null })),
        fetchProducts({ featured: 'true', page: 1 }).catch(() => ({ results: [] as Product[], next: null })),
        fetchTopStores().catch(() => [] as Store[]),
      ]);
      setDeals(dealsRes.results.slice(0, 10));
      setNewArrivals(newArrRes.results.slice(0, 10));
      setRecommended(featRes.results.slice(0, 10));
      setTopStores(stores.slice(0, 10));
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

  // ── Refresh cart count when screen gains focus ──────────────────
  const loadCartCount = useCallback(async () => {
    if (!isAuthenticated) { setCartCount(0); return; }
    try {
      const count = await getCartCount();
      setCartCount(count);
    } catch {
      setCartCount(0);
    }
  }, [isAuthenticated]);

  const loadChatUnread = useCallback(async () => {
    if (!isAuthenticated) { setChatUnread(0); return; }
    try {
      const count = await getChatUnreadCount();
      setChatUnread(count);
    } catch {
      setChatUnread(0);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadCartCount();
    loadChatUnread();
  }, [loadCartCount, loadChatUnread]);

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
    loadCartCount();
  }, [loadProducts, loadAllSections, loadCategories, loadCartCount]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || refreshing) return;
    loadProducts(false);
  }, [hasMore, loadingMore, refreshing, loadProducts]);

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

  const handleAddToCart = useCallback(async (product: Product) => {
    try {
      await addToCart(product.id, product.min_order_quantity || 1);
      const count = await getCartCount();
      setCartCount(count);
    } catch (e: any) {
      console.error('Add to cart error:', e?.message);
    }
  }, []);

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
      <ProductCard item={item} onPress={handleProductPress} onAddToCart={handleAddToCart} onChat={handleChat} />
    ),
    [handleProductPress, handleAddToCart, handleChat]
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

      {/* ── Quick links grid (Top Stores, Suppliers, Verified, Sell) ── */}
      <View style={styles.quickLinksContainer}>
        <Pressable
          style={({ pressed }) => [styles.quickLink, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/suppliers' as any)}
        >
          <View style={[styles.quickLinkIcon, { backgroundColor: '#FFF3E8' }]}>
            <MaterialCommunityIcons name="store" size={24} color={Brand.primary} />
          </View>
          <Text style={styles.quickLinkText}>Top Stores</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickLink, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/suppliers' as any)}
        >
          <View style={[styles.quickLinkIcon, { backgroundColor: '#E8F5E9' }]}>
            <MaterialCommunityIcons name="factory" size={24} color="#16A34A" />
          </View>
          <Text style={styles.quickLinkText}>Suppliers</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickLink, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/suppliers' as any)}
        >
          <View style={[styles.quickLinkIcon, { backgroundColor: '#E3F2FD' }]}>
            <MaterialCommunityIcons name="shield-check" size={24} color='#1976D2' />
          </View>
          <Text style={styles.quickLinkText}>Verified</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickLink, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/suppliers' as any)}
        >
          <View style={[styles.quickLinkIcon, { backgroundColor: '#FCE4EC' }]}>
            <MaterialCommunityIcons name="account-plus" size={24} color='#C62828' />
          </View>
          <Text style={styles.quickLinkText}>Sell</Text>
        </Pressable>
      </View>

      {/* Category chips — dynamic from API */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {/* "All" chip */}
        <Pressable
          style={({ pressed }) => [
            styles.chip,
            activeCategory === null ? styles.chipActive : styles.chipInactive,
            pressed && styles.chipPressed,
          ]}
          onPress={() => setActiveCategory(null)}
        >
          <Text
            style={[
              styles.chipText,
              activeCategory === null ? styles.chipTextActive : styles.chipTextInactive,
            ]}
          >
            All
          </Text>
        </Pressable>
        {categories.slice(0, 15).map((cat) => {
          const active = cat.slug === activeCategory;
          return (
            <Pressable
              key={cat.id}
              style={({ pressed }) => [
                styles.chip,
                active ? styles.chipActive : styles.chipInactive,
                pressed && styles.chipPressed,
              ]}
              onPress={() => setActiveCategory(cat.slug)}
            >
              <Text
                style={[
                  styles.chipText,
                  active ? styles.chipTextActive : styles.chipTextInactive,
                ]}
                numberOfLines={1}
              >
                {cat.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Today's Deals — horizontal sliding carousel ──────────── */}
      {renderSection('fire', "Today's Deals", deals, () => router.push('/search'))}

      {/* ── New Arrivals — horizontal sliding carousel ───────────── */}
      {renderSection('package-variant-closed', 'New Arrivals', newArrivals, () => router.push('/search'))}

      {/* ── Recommended for You — horizontal sliding carousel ────── */}
      {renderSection('thumb-up-outline', 'Recommended for You', recommended, () => router.push('/search'))}

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
                  <MaterialCommunityIcons name="package-variant-closed" size={11} color="#6B7280" />
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

      {/* ── All Products section title ───────────────────────────── */}
      <View style={styles.allProductsHeader}>
        <MaterialCommunityIcons name="view-grid" size={22} color={Brand.primary} />
        <Text style={styles.allProductsTitle}>
          {activeCategory
            ? categories.find((c) => c.slug === activeCategory)?.name || 'Products'
            : 'All Products'}
        </Text>
      </View>
    </View>
  );

  if (loading && products.length === 0) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Header */}
          <LinearGradient colors={['#ff6a00', '#ff8520', '#ff9500']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
            <Text style={styles.logo}>Diilzo</Text>
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
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Header */}
          <LinearGradient colors={['#ff6a00', '#ff8520', '#ff9500']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
            <Text style={styles.logo}>Diilzo</Text>
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
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Gradient header bar */}
        <LinearGradient colors={['#ff6a00', '#ff8520', '#ff9500']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          {/* App name on left */}
          <Text style={styles.logo}>Diilzo</Text>
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

      <FlatList
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 0, backgroundColor: '#FFFFFF' },

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
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
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
    borderColor: '#ff6a00',
  },
  cartBadgeText: {
    color: '#ff6a00',
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
    borderColor: '#ff6a00',
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
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Brand.yellow,
    marginHorizontal: Spacing.two,
    marginTop: Spacing.two,
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

  // ── Category chips ──────────────────────────────────────────────
  chipsRow: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
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
    borderRadius: 6,
    paddingVertical: Spacing.two,
    marginHorizontal: 0,
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
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#FFF3E8',
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: Brand.primary,
  },
  allProductsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.text,
  },

  // ── Quick links ─────────────────────────────────────────────────
  quickLinksContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  quickLink: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  quickLinkIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLinkText: { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center' },

  // ── Top Stores section ──────────────────────────────────────────
  storesSection: {
    backgroundColor: '#FFFFFF',
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F3F4F6',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  storesCarousel: { paddingHorizontal: Spacing.three, gap: 12 },
  storeCard: {
    width: 120,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
  storeName: { fontSize: 13, fontWeight: '700', color: '#1F2937', textAlign: 'center' },
  storeLocation: { fontSize: 11, color: '#6B7280', textAlign: 'center' },
  storeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  storeMetaText: { fontSize: 11, color: '#6B7280' },
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
    borderRadius: 6,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },

  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  noImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
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
    borderRadius: 6,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addToCartPressed: { backgroundColor: Brand.primaryDark },
  addToCartText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  inquiryBtn: {
    flex: 1,
    backgroundColor: '#FFF3E8',
    borderRadius: 6,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Brand.primary,
  },
  inquiryBtnPressed: { backgroundColor: '#FFE4CC' },
  inquiryBtnText: {
    color: Brand.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  viewBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  viewBtnPressed: { backgroundColor: '#E5E7EB' },
  viewBtnText: {
    color: '#6B7280',
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
    backgroundColor: 'rgba(0,0,0,0.65)',
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
