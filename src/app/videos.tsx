import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useFocusEffect, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { fetchCategories } from '@/services/catalog';
import { fetchProducts } from '@/services/products';
import { addToWishlist, fetchWishlist, removeFromWishlist } from '@/services/wishlist';
import type { Category, Product, WishlistItem } from '@/types';

// ── TikTok-style video player for direct Cloudinary uploads ──────────
function DirectVideoPlayer({
  uri,
  isActive,
  onEnd,
  onDoubleTap,
  onSingleTap,
  showOverlay,
  posterImage,
}: {
  uri: string;
  isActive: boolean;
  onEnd: () => void;
  onDoubleTap: () => void;
  onSingleTap: () => void;
  showOverlay: boolean;
  posterImage?: string | null;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = false;
    p.timeUpdateEventInterval = 0.1;
    if (isActive) p.play();
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const timeUpdate = useEvent(player, 'timeUpdate', null);

  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const lastTapRef = useRef(0);

  // Play/pause based on active state — seek to start when reactivated
  useEffect(() => {
    if (isActive) {
      // If video has ended, seek back to start before playing
      const dur = player.duration || 0;
      if (dur > 0 && player.currentTime >= dur - 0.5) {
        player.currentTime = 0;
      }
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  // Pause and release on unmount (when scrolling away or leaving screen)
  useEffect(() => {
    return () => {
      player.pause();
    };
  }, [player]);

  // Auto-advance when video ends (playToEnd event)
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      onEnd();
    });
    return () => sub.remove();
  }, [player, onEnd]);

  const toggleMute = useCallback(() => {
    const newMuted = !mutedRef.current;
    mutedRef.current = newMuted;
    setMuted(newMuted);
    player.muted = newMuted;
  }, [player]);

  const seekTo = useCallback((ratio: number) => {
    const dur = player.duration || 0;
    if (dur > 0) {
      player.currentTime = Math.max(0, Math.min(ratio * dur, dur));
    }
  }, [player]);

  // Handle tap — single tap = toggle overlay, double tap = like
  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap — like
      onDoubleTap();
      lastTapRef.current = 0;
    } else {
      // Single tap — toggle overlay visibility (parent handles)
      lastTapRef.current = now;
      onSingleTap();
    }
  }, [onDoubleTap, onSingleTap]);

  const currentTime = timeUpdate?.currentTime ?? 0;
  const duration = player.duration || 0;
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const isLoading = status === 'loading' || status === 'idle';

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={directVideoStyles.container}>
      {/* Poster image while loading */}
      {isLoading && posterImage ? (
        <Image source={{ uri: posterImage }} style={directVideoStyles.poster} resizeMode="cover" />
      ) : null}

      <VideoView
        style={directVideoStyles.video}
        player={player}
        contentFit="contain"
        nativeControls={false}
        allowsPictureInPicture={false}
      />

      {/* Tap overlay */}
      <Pressable style={directVideoStyles.tapOverlay} onPress={handleTap}>
        {/* Loading spinner */}
        {isLoading && (
          <View style={directVideoStyles.centerWrap}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        )}

        {/* Play button when paused */}
        {!isPlaying && !isLoading && (
          <View style={directVideoStyles.playBtnCircle}>
            <MaterialCommunityIcons name="play" size={36} color="#FFFFFF" />
          </View>
        )}
      </Pressable>

      {/* Controls overlay (mute, time) — visible when overlay is shown */}
      {showOverlay && (
        <View style={directVideoStyles.controlsRow}>
          {/* Time display */}
          <Text style={directVideoStyles.timeText}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
          {/* Mute toggle */}
          <Pressable style={directVideoStyles.muteBtn} onPress={toggleMute} hitSlop={12}>
            <MaterialCommunityIcons
              name={muted ? 'volume-mute' : 'volume-high'}
              size={22}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      )}

      {/* Seekable progress bar */}
      {duration > 0 && (
        <Pressable
          style={directVideoStyles.progressTrack}
          onPress={(e) => {
            const trackWidth = (e.nativeEvent as any).layoutMeasurement?.width || 1;
            const ratio = Math.max(0, Math.min(e.nativeEvent.locationX / trackWidth, 1));
            seekTo(ratio);
          }}
        >
          <View style={directVideoStyles.progressBg} />
          <View style={[directVideoStyles.progressFill, { width: `${progress * 100}%` }]} />
          <View style={[directVideoStyles.progressThumb, { left: `${progress * 100}%` }]} />
        </Pressable>
      )}
    </View>
  );
}

const directVideoStyles = StyleSheet.create({
  container: { flex: 1, position: 'relative', backgroundColor: '#000' },
  poster: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  video: { flex: 1, width: '100%', height: '100%' },
  tapOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  centerWrap: { justifyContent: 'center', alignItems: 'center' },
  playBtnCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  controlsRow: {
    position: 'absolute',
    bottom: 90, left: 12, right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  muteBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 80, left: 0, right: 0,
    height: 20,
    justifyContent: 'center',
  },
  progressBg: {
    height: 3, width: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
  },
  progressFill: {
    position: 'absolute',
    height: 3,
    backgroundColor: Brand.primary,
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Brand.primary,
    marginLeft: -6,
    bottom: 4,
  },
});

// ── Heart burst on double-tap like ─────────────────────────────────
function HeartBurst({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <View pointerEvents="none" style={heartStyles.container}>
      <MaterialCommunityIcons name="heart" size={100} color="#FF4757" />
    </View>
  );
}

const heartStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function VideosScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { height: screenHeight } = useWindowDimensions();

  // Tab bar is 88px (from app-tabs.tsx). Header ~48px. Tabs row ~40px.
  // Feed item height = visible area between header+tabs and tab bar.
  const TAB_BAR_HEIGHT = 88;
  const HEADER_HEIGHT = 48;
  const TABS_HEIGHT = 40;
  const feedHeight = screenHeight - TAB_BAR_HEIGHT - HEADER_HEIGHT - TABS_HEIGHT;

  // ── State ────────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Overlay visibility — hides when video plays, shows on tap
  const [showOverlay, setShowOverlay] = useState(true);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide overlay after 3 seconds when video is playing
  useEffect(() => {
    if (isPlaying && showOverlay) {
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
      overlayTimer.current = setTimeout(() => setShowOverlay(false), 3000);
    }
    return () => {
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
    };
  }, [isPlaying, showOverlay]);

  // Show overlay when video pauses
  useEffect(() => {
    if (!isPlaying) {
      setShowOverlay(true);
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
    }
  }, [isPlaying]);

  // Toggle overlay on tap (called from DirectVideoPlayer single tap)
  const handleOverlayToggle = useCallback(() => {
    setShowOverlay((prev) => {
      const next = !prev;
      if (next && isPlaying) {
        if (overlayTimer.current) clearTimeout(overlayTimer.current);
        overlayTimer.current = setTimeout(() => setShowOverlay(false), 3000);
      }
      return next;
    });
    // If video is not playing (ended or paused), resume on tap
    if (!isPlaying) {
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // Heart burst animation per item
  const [heartBurstIndex, setHeartBurstIndex] = useState<number | null>(null);

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

  // ── Pause video when screen loses focus (leaving tab, opening another page) ──
  useFocusEffect(
    useCallback(() => {
      // Returning from another screen — resume playing
      setIsPlaying(true);
      return () => {
        // Leaving the screen — pause the video
        setIsPlaying(false);
      };
    }, [])
  );

  // ── Pause video when app goes to background (closing, home button, etc.) ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        setIsPlaying(false);
      }
    });
    return () => sub.remove();
  }, []);

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
    const thumb = item.primary_image_url;
    const isWishlisted = wishlistIds.has(item.id);
    const isActive = index === activeIndex;
    const hasDirectVideo = Boolean(item.video_file_url);

    // Double-tap to like
    const handleDoubleTap = () => {
      if (!isWishlisted) {
        handleWishlistToggle(item);
      }
      // Trigger heart burst
      setHeartBurstIndex(index);
      setTimeout(() => setHeartBurstIndex(null), 1000);
    };

    return (
      <View style={[styles.feedItem, { height: feedHeight }]}>
        {/* Direct video (Cloudinary) — TikTok-style, no controls */}
        {hasDirectVideo && item.video_file_url ? (
          isActive ? (
            <DirectVideoPlayer
              uri={item.video_file_url}
              isActive={isActive && isPlaying}
              onEnd={handleVideoEnd}
              onDoubleTap={handleDoubleTap}
              onSingleTap={handleOverlayToggle}
              showOverlay={showOverlay}
              posterImage={thumb}
            />
          ) : (
            <>
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.thumbnail} resizeMode="cover" />
              ) : (
                <View style={styles.thumbnailFallback} />
              )}
              <View style={styles.overlay} />
              <Pressable style={styles.playBtn} onPress={() => {
                setActiveIndex(index);
                setIsPlaying(true);
                listRef.current?.scrollToIndex({ index, animated: true });
              }}>
                <MaterialCommunityIcons name="play-circle" size={72} color="rgba(255,255,255,0.9)" />
              </Pressable>
            </>
          )
        ) : (
          <>
            {/* Thumbnail for non-video items */}
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumbnail} resizeMode="cover" />
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
        {!(isActive && hasDirectVideo && isPlaying) || showOverlay ? (
          <View style={styles.bottomGradient} />
        ) : null}

        {/* Heart burst on double-tap like */}
        <HeartBurst visible={heartBurstIndex === index} />

        {/* Right action bar (TikTok-style) — hidden when video playing without overlay */}
        {!(isActive && hasDirectVideo && isPlaying) || showOverlay ? (
          <View style={styles.actionBar}>
            <Pressable
              style={styles.actionAvatar}
              onPress={() => item.store?.slug && router.push(`/store/${item.store.slug}` as any)}
            >
              {item.store?.logo_url ? (
                <Image source={{ uri: item.store.logo_url }} style={styles.storeAvatar} resizeMode="contain" />
              ) : (
                <View style={styles.storeAvatarFallback}>
                  <MaterialCommunityIcons name="store" size={18} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
            {/* Pause / Play */}
            {isActive && hasDirectVideo ? (
              <Pressable style={styles.actionItem} onPress={() => setIsPlaying((p) => !p)}>
                <MaterialCommunityIcons
                  name={isPlaying ? 'pause' : 'play'}
                  size={30}
                  color="#FFFFFF"
                />
                <Text style={styles.actionText}>{isPlaying ? 'Pause' : 'Play'}</Text>
              </Pressable>
            ) : null}
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
        ) : null}

        {/* Bottom product info — hidden when video playing without overlay */}
        {!(isActive && hasDirectVideo && isPlaying) || showOverlay ? (
          <View style={styles.bottomInfo}>
            <Pressable
              style={styles.storeRow}
              onPress={() => item.store?.slug && router.push(`/store/${item.store.slug}` as any)}
            >
              <MaterialCommunityIcons name="store" size={13} color={Brand.primary} />
              <Text style={styles.storeName} numberOfLines={1}>
                {item.store?.name || 'Diilzo Store'}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={14} color={Brand.primary} />
            </Pressable>
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
        ) : null}
      </View>
    );
  }, [feedHeight, activeIndex, isPlaying, showOverlay, wishlistIds, heartBurstIndex, handleVideoEnd, handleOverlayToggle, handleWishlistToggle, handleShare, router]);

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
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Videos</Text>
        <Pressable style={styles.headerSearchBtn} onPress={() => setShowSearch((prev) => !prev)}>
          <MaterialCommunityIcons name="magnify" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* ── Category tabs ──────────────────────────────────────────── */}
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
        keyExtractor={(item) => `video-${item.id}-${item.slug}`}
        renderItem={renderVideoItem}
        extraData={activeIndex + (isPlaying ? '-playing' : '-paused')}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={3}
        removeClippedSubviews={false}
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

  // ── Header ──────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0a0a0a',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  headerSearchBtn: { paddingHorizontal: 8, paddingVertical: 4 },
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
    top: 0, left: 0, right: 70, bottom: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Action bar (right side, TikTok-style) ───────────────────────
  actionBar: {
    position: 'absolute',
    right: 12,
    bottom: 140,
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
    bottom: 100,
    left: 0,
    right: 70,
    padding: 16,
    paddingBottom: 16,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  storeName: { color: Brand.primary, fontSize: 14, fontWeight: '700' },
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
