import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { fetchCategories } from '@/services/catalog';
import { fetchProducts } from '@/services/products';
import { getYouTubeId, getYouTubeThumbnail } from '@/services/videos';
import { addToWishlist, fetchWishlist, removeFromWishlist } from '@/services/wishlist';
import type { Category, Product, WishlistItem } from '@/types';

export default function VideosScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { height: screenHeight } = useWindowDimensions();

  // ── State ────────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Category tabs
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Wishlist
  const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set());
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);

  const listRef = useRef<FlatList<Product>>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // ── Load categories for tabs ──────────────────────────────────────
  useEffect(() => {
    fetchCategories()
      .then((cats) => setCategories(cats))
      .catch((e) => console.error('Category fetch error:', e?.message));
  }, []);

  // ── Load wishlist status ──────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchWishlist()
      .then((items) => {
        setWishlistItems(items);
        setWishlistIds(new Set(items.map((i) => i.product.id)));
      })
      .catch(() => { });
  }, [isAuthenticated]);

  // ── Load videos ───────────────────────────────────────────────────
  const load = useCallback(async (reset = false) => {
    const targetPage = reset ? 1 : page;
    try {
      const params: Record<string, any> = {
        has_video: 'true',
        page: targetPage,
      };
      if (activeCategory) params.category = activeCategory;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const data = await fetchProducts(params);

      if (reset) {
        setProducts(data.results || []);
        setPage(2);
      } else {
        setProducts((prev) => [...prev, ...(data.results || [])]);
        setPage((prev) => prev + 1);
      }
      setHasMore(!!data.next);
    } catch (e: any) {
      console.error('Video fetch error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [page, activeCategory, searchQuery]);

  // Reload when category or search changes
  useEffect(() => {
    setLoading(true);
    setProducts([]);
    setActiveIndex(0);
    setPage(1);
    setHasMore(true);
    setIsPlaying(true);
    load(true);
  }, [activeCategory, searchQuery]);

  // ── Handlers ──────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setActiveIndex(0);
    setPage(1);
    setHasMore(true);
    setIsPlaying(true);
    load(true);
  }, [load]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    load(false);
  }, [loadingMore, hasMore, load]);

  // Track active video via viewability — plays the visible video, pauses others
  const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
      setIsPlaying(true);
    }
  }, []);

  // Toggle play/pause on tap
  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Auto-advance to next video when current ends
  const handleVideoEnd = useCallback(() => {
    if (activeIndex < products.length - 1) {
      const nextIndex = activeIndex + 1;
      setActiveIndex(nextIndex);
      setIsPlaying(true);
      listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    } else {
      setIsPlaying(false);
    }
  }, [activeIndex, products.length]);

  // Wishlist toggle
  const handleWishlistToggle = useCallback(async (product: Product) => {
    if (!isAuthenticated) {
      router.push('/(auth)/login' as any);
      return;
    }
    const productId = product.id;
    const isWishlisted = wishlistIds.has(productId);
    try {
      if (isWishlisted) {
        const item = wishlistItems.find((i) => i.product.id === productId);
        if (item) {
          await removeFromWishlist(item.id);
          setWishlistIds((prev) => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
          });
          setWishlistItems((prev) => prev.filter((i) => i.product.id !== productId));
        }
      } else {
        const newItem = await addToWishlist(productId);
        setWishlistIds((prev) => new Set(prev).add(productId));
        setWishlistItems((prev) => [...prev, newItem]);
      }
    } catch (e: any) {
      console.error('Wishlist error:', e?.message);
    }
  }, [isAuthenticated, wishlistIds, wishlistItems, router]);

  // Share
  const handleShare = useCallback(async (product: Product) => {
    try {
      await Share.share({
        message: `Check out ${product.name} on Diilzo — ${product.currency} ${Number(product.final_price).toLocaleString()}`,
        url: `https://diilzo-market-place-production.up.railway.app/products/${product.slug}`,
        title: product.name,
      });
    } catch (e: any) {
      console.error('Share error:', e?.message);
    }
  }, []);

  // ── Render each video card (inline playback, no modal) ────────────
  const renderVideoItem = useCallback(({ item, index }: { item: Product; index: number }) => {
    const videoId = getYouTubeId(item.video_url || '');
    const thumb = videoId ? getYouTubeThumbnail(videoId) : item.primary_image_url;
    const isWishlisted = wishlistIds.has(item.id);
    const isActive = index === activeIndex;

    return (
      <View style={[styles.feedItem, { height: screenHeight }]}>
        {/* YouTube player — only active video renders, fills entire item */}
        {videoId && isActive ? (
          <YoutubePlayer
            videoId={videoId}
            height={screenHeight}
            play={isPlaying}
            onChangeState={(e: string) => {
              if (e === 'ended') handleVideoEnd();
            }}
          />
        ) : (
          <>
            {/* Thumbnail for non-active items */}
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumbnail} contentFit="cover" transition={200} />
            ) : (
              <View style={styles.thumbnailFallback} />
            )}
            <View style={styles.overlay} />
            {/* Tap to play */}
            <Pressable style={styles.playBtn} onPress={() => {
              setActiveIndex(index);
              setIsPlaying(true);
              listRef.current?.scrollToIndex({ index, animated: true });
            }}>
              <MaterialCommunityIcons name="play-circle" size={72} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </>
        )}

        {/* Bottom gradient for text readability */}
        <View style={styles.bottomGradient} />

        {/* Tap to pause/play (only for active video, above action bar area) */}
        {isActive && (
          <Pressable
            style={styles.tapToggle}
            onPress={handleTogglePlay}
          >
            {!isPlaying && (
              <MaterialCommunityIcons name="play-circle" size={72} color="rgba(255,255,255,0.8)" />
            )}
          </Pressable>
        )}

        {/* Right action bar (TikTok-style) */}
        <View style={styles.actionBar}>
          <View style={styles.actionAvatar}>
            {item.store?.logo_url ? (
              <Image source={{ uri: item.store.logo_url }} style={styles.storeAvatar} contentFit="contain" />
            ) : (
              <View style={styles.storeAvatarFallback}>
                <MaterialCommunityIcons name="store" size={18} color="#FFFFFF" />
              </View>
            )}
          </View>
          {/* Wishlist */}
          <Pressable style={styles.actionItem} onPress={() => handleWishlistToggle(item)}>
            <MaterialCommunityIcons
              name={isWishlisted ? 'heart' : 'heart-outline'}
              size={30}
              color={isWishlisted ? '#FF4757' : '#FFFFFF'}
            />
            <Text style={styles.actionText}>{isWishlisted ? 'Saved' : 'Save'}</Text>
          </Pressable>
          {/* Share */}
          <Pressable style={styles.actionItem} onPress={() => handleShare(item)}>
            <MaterialCommunityIcons name="share-variant" size={30} color="#FFFFFF" />
            <Text style={styles.actionText}>Share</Text>
          </Pressable>
          {/* Buy */}
          <Pressable style={styles.actionItem} onPress={() => router.push(`/product/${item.slug}` as any)}>
            <MaterialCommunityIcons name="shopping" size={30} color="#FFFFFF" />
            <Text style={styles.actionText}>Buy</Text>
          </Pressable>
          {/* Rating */}
          <View style={styles.actionItem}>
            <MaterialCommunityIcons name="star" size={30} color={Brand.rating} />
            <Text style={styles.actionText}>{item.rating ? parseFloat(item.rating).toFixed(1) : '0.0'}</Text>
          </View>
        </View>

        {/* Bottom product info */}
        <View style={styles.bottomInfo}>
          <Text style={styles.storeName} numberOfLines={1}>
            {item.store?.name || 'Diilzo Store'}
          </Text>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          {item.short_description ? (
            <Text style={styles.description} numberOfLines={2}>{item.short_description}</Text>
          ) : null}
          <View style={styles.priceRow}>
            <Text style={styles.currency}>{item.currency} </Text>
            <Text style={styles.price}>{Number(item.final_price).toLocaleString()}</Text>
            {item.is_on_sale && (
              <View style={styles.saleTag}>
                <Text style={styles.saleTagText}>{item.discount_percentage}% OFF</Text>
              </View>
            )}
          </View>
          <Pressable
            style={styles.viewProductBtn}
            onPress={() => router.push(`/product/${item.slug}` as any)}
          >
            <MaterialCommunityIcons name="arrow-right-circle" size={20} color="#FFFFFF" />
            <Text style={styles.viewProductText}>View Product</Text>
          </Pressable>
        </View>
      </View>
    );
  }, [screenHeight, activeIndex, isPlaying, wishlistIds, handleVideoEnd, handleTogglePlay, handleWishlistToggle, handleShare, router]);

  // ── Loading state ─────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color={Brand.primary} />
        <Text style={styles.loadingText}>Loading videos...</Text>
      </View>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────
  if (products.length === 0) {
    return (
      <View style={styles.centerScreen}>
        <View style={styles.emptyIconWrap}>
          <MaterialCommunityIcons name="play-circle-outline" size={56} color={Brand.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>No videos yet</Text>
        <Text style={styles.emptySubtext}>
          {searchQuery || activeCategory
            ? 'Try a different category or search'
            : 'Product videos will appear here'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* ── Category tabs + search bar ────────────────────────────── */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          <Pressable
            style={[styles.tab, !activeCategory && styles.tabActive]}
            onPress={() => setActiveCategory(null)}
          >
            <Text style={[styles.tabText, !activeCategory && styles.tabTextActive]}>All</Text>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={`cat-tab-${cat.id}-${cat.slug}`}
              style={[styles.tab, activeCategory === cat.slug && styles.tabActive]}
              onPress={() => setActiveCategory(cat.slug)}
            >
              <Text style={[styles.tabText, activeCategory === cat.slug && styles.tabTextActive]}>
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          style={styles.searchToggleBtn}
          onPress={() => setShowSearch((prev) => !prev)}
        >
          <MaterialCommunityIcons name="magnify" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Search bar (collapsible) */}
      {showSearch && (
        <View style={styles.searchBarWrap}>
          <MaterialCommunityIcons name="magnify" size={18} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search videos..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <MaterialCommunityIcons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
            </Pressable>
          )}
        </View>
      )}

      {/* ── Vertical swipe feed (FlatList with paging + inline video) ── */}
      <FlatList
        ref={listRef}
        data={products}
        keyExtractor={(item, index) => `video-${item.id}-${item.slug}-${index}`}
        renderItem={renderVideoItem}
        extraData={activeIndex + (isPlaying ? '-playing' : '-paused')}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true });
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Brand.primary]}
            tintColor={Brand.primary}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator size="small" color={Brand.primary} />
            </View>
          ) : null
        }
      />

      {/* ── Progress indicator ────────────────────────────────────── */}
      <View style={styles.progressWrap}>
        <Text style={styles.progressText}>{activeIndex + 1} / {products.length}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  centerScreen: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, color: Brand.textTertiary, fontSize: 14 },
  emptyIconWrap: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  emptySubtext: { marginTop: 8, fontSize: 14, color: Brand.textTertiary, textAlign: 'center' },

  // ── Category tabs ────────────────────────────────────────────────
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    paddingVertical: 8,
    paddingRight: 8,
  },
  tabsContent: { paddingHorizontal: 8, gap: 6 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: { backgroundColor: Brand.primary },
  tabText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' },
  searchToggleBtn: { paddingHorizontal: 8, paddingVertical: 4 },

  // ── Search bar ───────────────────────────────────────────────────
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#FFFFFF', padding: 0 },

  // ── Feed ────────────────────────────────────────────────────────
  feedItem: { flex: 1, position: 'relative', backgroundColor: '#000000' },
  thumbnail: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  thumbnailFallback: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1a1a1a' },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 280,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  // ── Play / pause ────────────────────────────────────────────────
  playBtn: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -36,
    marginLeft: -36,
  },
  tapToggle: {
    position: 'absolute',
    top: 0, left: 0, right: 70, bottom: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Action bar (right side, TikTok-style) ───────────────────────
  actionBar: {
    position: 'absolute',
    right: 12,
    bottom: 100,
    alignItems: 'center',
    gap: 18,
  },
  actionAvatar: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: Brand.primary,
    overflow: 'hidden', marginBottom: 4,
  },
  storeAvatar: { width: '100%', height: '100%' },
  storeAvatarFallback: {
    width: '100%', height: '100%',
    backgroundColor: Brand.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  actionItem: { alignItems: 'center', gap: 4 },
  actionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  // ── Bottom info ─────────────────────────────────────────────────
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 70,
    padding: 16,
    paddingBottom: 60,
  },
  storeName: { color: Brand.primary, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  productName: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', lineHeight: 24, marginBottom: 6 },
  description: { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  currency: { color: Brand.primary, fontSize: 14, fontWeight: '700' },
  price: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  saleTag: {
    backgroundColor: Brand.danger,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
    marginLeft: 8,
  },
  saleTagText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  viewProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Brand.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignSelf: 'flex-start',
  },
  viewProductText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // ── Progress ────────────────────────────────────────────────────
  progressWrap: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 12,
  },
  progressText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  // ── Footer loading ──────────────────────────────────────────────
  footerLoading: { paddingVertical: 20, alignItems: 'center' },
});
