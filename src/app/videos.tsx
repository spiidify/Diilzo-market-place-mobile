import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEvent } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    FlatList,
    Image,
    Keyboard,
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { fetchCategories } from '@/services/catalog';
import { esSearchProducts, fetchProducts, getAutocomplete, getTrendingSearches, logSearchClick } from '@/services/products';
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
  muted,
  onToggleMute,
  posterImage,
}: {
  uri: string;
  isActive: boolean;
  onEnd: () => void;
  onDoubleTap: () => void;
  onSingleTap: () => void;
  showOverlay: boolean;
  muted: boolean;
  onToggleMute: () => void;
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

  const lastTapRef = useRef(0);

  // Play/pause based on active state — seek to start when reactivated
  useEffect(() => {
    try {
      if (isActive) {
        const dur = player.duration || 0;
        if (dur > 0 && player.currentTime >= dur - 0.5) {
          player.currentTime = 0;
        }
        player.play();
      } else {
        player.pause();
      }
    } catch { }
  }, [isActive, player]);

  // Pause on unmount
  useEffect(() => {
    return () => {
      try { player.pause(); } catch { }
    };
  }, [player]);

  // Sync muted from parent
  useEffect(() => {
    try {
      player.muted = muted;
      player.volume = muted ? 0 : 1;
    } catch { }
  }, [muted, player]);

  // Auto-advance when video ends
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      onEnd();
    });
    return () => sub.remove();
  }, [player, onEnd]);

  const seekTo = useCallback((ratio: number) => {
    try {
      const dur = player.duration || 0;
      if (dur > 0) {
        player.currentTime = Math.max(0, Math.min(ratio * dur, dur));
      }
    } catch { }
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

      {/* Controls overlay (time) — visible when overlay is shown */}
      {showOverlay && (
        <View style={directVideoStyles.controlsRow}>
          <Text style={directVideoStyles.timeText}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </View>
      )}

      {/* Seekable progress bar — at the very bottom */}
      {duration > 0 && showOverlay && (
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
    bottom: 0, left: 0, right: 0,
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

// ── Grid video player for search results (2-column, muted autoplay) ──
function GridVideoPlayer({
  uri,
  isActive,
  posterImage,
  productName,
  storeName,
  price,
  currency,
  isOnSale,
  discountPercentage,
  isWishlisted,
  onPress,
  onWishlistToggle,
}: {
  uri: string;
  isActive: boolean;
  posterImage?: string | null;
  productName: string;
  storeName: string;
  price: number;
  currency: string;
  isOnSale?: boolean;
  discountPercentage?: number;
  isWishlisted: boolean;
  onPress: () => void;
  onWishlistToggle: () => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.timeUpdateEventInterval = 0.1;
    if (isActive) p.play();
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });

  // Play/pause based on active state
  useEffect(() => {
    try {
      if (isActive) {
        const dur = player.duration || 0;
        if (dur > 0 && player.currentTime >= dur - 0.5) {
          player.currentTime = 0;
        }
        player.play();
      } else {
        player.pause();
      }
    } catch { }
  }, [isActive, player]);

  // Always muted in grid mode
  useEffect(() => {
    try {
      player.muted = true;
      player.volume = 0;
    } catch { }
  }, [player]);

  // Pause on unmount
  useEffect(() => {
    return () => {
      try { player.pause(); } catch { }
    };
  }, [player]);

  const isLoading = status === 'loading' || status === 'idle';

  return (
    <Pressable style={gridVideoStyles.container} onPress={onPress}>
      {/* Poster image while loading */}
      {isLoading && posterImage ? (
        <Image source={{ uri: posterImage }} style={gridVideoStyles.poster} resizeMode="cover" />
      ) : null}

      <VideoView
        style={gridVideoStyles.video}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />

      {/* Loading spinner */}
      {isLoading && (
        <View style={gridVideoStyles.loadingWrap}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      )}

      {/* Bottom gradient for text readability */}
      <View style={gridVideoStyles.bottomGradient} />

      {/* Mute indicator */}
      <View style={gridVideoStyles.muteBadge}>
        <MaterialCommunityIcons name="volume-mute" size={12} color="#FFFFFF" />
      </View>

      {/* Sale badge */}
      {isOnSale && (
        <View style={gridVideoStyles.saleBadge}>
          <Text style={gridVideoStyles.saleBadgeText}>-{discountPercentage}%</Text>
        </View>
      )}

      {/* Wishlist heart */}
      <Pressable style={gridVideoStyles.wishlistBtn} onPress={(e) => { e.stopPropagation(); onWishlistToggle(); }}>
        <MaterialCommunityIcons
          name={isWishlisted ? 'heart' : 'heart-outline'}
          size={18}
          color={isWishlisted ? '#FF4757' : '#FFFFFF'}
        />
      </Pressable>

      {/* Product info overlay */}
      <View style={gridVideoStyles.info}>
        <Text style={gridVideoStyles.storeName} numberOfLines={1}>{storeName}</Text>
        <Text style={gridVideoStyles.productName} numberOfLines={2}>{productName}</Text>
        <View style={gridVideoStyles.priceRow}>
          <Text style={gridVideoStyles.currency}>{currency} </Text>
          <Text style={gridVideoStyles.price}>{price.toLocaleString()}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const gridVideoStyles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
  },
  poster: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  video: { flex: 1, width: '100%', height: '100%' },
  loadingWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 100,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  muteBadge: {
    position: 'absolute',
    top: 8, right: 8,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saleBadge: {
    position: 'absolute',
    top: 8, left: 8,
    backgroundColor: Brand.danger,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  saleBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  wishlistBtn: {
    position: 'absolute',
    bottom: 90, right: 8,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 8,
  },
  storeName: { color: Brand.primary, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  productName: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', lineHeight: 16, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  currency: { color: Brand.primary, fontSize: 10, fontWeight: '700' },
  price: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});

export default function VideosScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { isTablet, productColumns } = useResponsiveLayout();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ product?: string }>();
  const targetProductSlug = params.product || null;
  const { isAuthenticated } = useAuth();
  const { height: screenHeight } = useWindowDimensions();

  // Tab bar is 88px (from app-tabs.tsx). Header ~56px. Tabs row ~40px.
  // Feed item height = visible area between header+tabs and tab bar.
  const TAB_BAR_HEIGHT = isTablet ? 0 : 88;
  const HEADER_HEIGHT = 56;
  const TABS_HEIGHT = 40;
  // Normal browse mode: header + tabs are visible
  const feedHeight = screenHeight - TAB_BAR_HEIGHT - HEADER_HEIGHT - TABS_HEIGHT;
  // Feed mode from grid: header + tabs are hidden, so feed fills full screen above tab bar
  const feedModeHeight = screenHeight - TAB_BAR_HEIGHT;

  // ── State ────────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoMuted, setVideoMuted] = useState(false);

  // Grid mode: track which video indices are visible for autoplay (search results)
  const [gridActiveIndices, setGridActiveIndices] = useState<Set<number>>(new Set());
  const gridListRef = useRef<FlatList>(null);
  const gridViewabilityConfig = useRef({ itemVisiblePercentThreshold: 50, minimumViewTime: 200 }).current;

  // When the user taps a grid video, switch to full-screen feed mode at that index
  const [feedMode, setFeedMode] = useState(false);
  const [feedStartIndex, setFeedStartIndex] = useState(0);

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

  const handleToggleMute = useCallback(() => {
    setVideoMuted((m) => !m);
  }, []);

  // Heart burst animation per item
  const [heartBurstIndex, setHeartBurstIndex] = useState<number | null>(null);

  // Category tabs
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Full-text search: autocomplete, recent searches, trending, suggestions
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);
  const [searchCount, setSearchCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const autocompleteAbortRef = useRef<AbortController | null>(null);
  const searchInputRef = useRef<TextInput>(null);

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

  // ── Load trending searches from API ───────────────────────────────
  useEffect(() => {
    getTrendingSearches(8)
      .then((terms) => { if (terms.length > 0) setTrendingSearches(terms); })
      .catch(() => { });
    AsyncStorage.getItem('video_recent_searches')
      .then((raw) => { if (raw) { try { setRecentSearches(JSON.parse(raw)); } catch { } } })
      .catch(() => { });
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
    // Cancel any in-flight request before issuing a new one
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (searchQuery.trim().length >= 2) {
        // Use PostgreSQL Full Text Search for video search
        const data = await esSearchProducts({
          q: searchQuery.trim(),
          page: targetPage,
          page_size: 20,
          has_video: 'true',
          ...(activeCategory ? { category: activeCategory } : {}),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (reset) setSuggestion(data.suggestion || null);
        setSearchCount(data.count);
        if (reset) {
          setProducts(data.results || []);
          setPage(2);
        } else {
          setProducts((prev) => [...prev, ...(data.results || [])]);
          setPage((prev) => prev + 1);
        }
        setHasMore(Boolean(data.has_next));
      } else {
        // No search query — browse all videos with category filter
        const params: Record<string, any> = {
          has_video: 'true',
          page: targetPage,
        };
        if (activeCategory) params.category = activeCategory;
        const data = await fetchProducts({ ...params, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (reset) setSuggestion(null);
        setSearchCount(data.count);
        if (reset) {
          setProducts(data.results || []);
          setPage(2);
        } else {
          setProducts((prev) => [...prev, ...(data.results || [])]);
          setPage((prev) => prev + 1);
        }
        // Normalize: PaginatedResponse uses `next` (URL string), SearchResult uses `has_next` (bool)
        setHasMore(Boolean((data as any).has_next ?? data.next));
      }
    } catch (e: any) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || controller.signal.aborted) return;
      console.error('Video fetch error:', e?.message);
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [page, activeCategory, searchQuery]);

  // Reload when category changes (immediate)
  useEffect(() => {
    setLoading(true);
    setProducts([]);
    setActiveIndex(0);
    setPage(1);
    setHasMore(true);
    setIsPlaying(true);
    load(true);
  }, [activeCategory]);

  // Debounced search (300ms) — avoids spamming the API on each keystroke
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      // Instantly reload all videos when search is cleared
      setLoading(true);
      setProducts([]);
      setActiveIndex(0);
      setPage(1);
      setHasMore(true);
      setIsPlaying(true);
      setSuggestion(null);
      setShowAutocomplete(false);
      setFeedMode(false);
      load(true);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      setProducts([]);
      setActiveIndex(0);
      setPage(1);
      setHasMore(true);
      setIsPlaying(true);
      setFeedMode(false);
      load(true);
      setShowAutocomplete(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Autocomplete debounce (150ms) — faster than full search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setAutocompleteItems([]);
      setShowAutocomplete(false);
      return;
    }
    if (autocompleteAbortRef.current) autocompleteAbortRef.current.abort();
    const t = setTimeout(async () => {
      try {
        const suggestions = await getAutocomplete(searchQuery.trim(), 6);
        if (suggestions.length > 0) {
          setAutocompleteItems(suggestions);
          setShowAutocomplete(true);
        } else {
          setShowAutocomplete(false);
        }
      } catch { }
    }, 150);
    return () => clearTimeout(t);
  }, [searchQuery]);

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

  // Grid viewability — track ALL visible items for muted autoplay (2-column grid)
  const handleGridViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    const newSet = new Set<number>();
    viewableItems.forEach((item: any) => {
      if (item.isViewable && item.index != null) {
        newSet.add(item.index);
      }
    });
    setGridActiveIndices(newSet);
  }, []);

  // Switch from grid view to full-screen feed at the tapped video's index
  const handleGridVideoPress = useCallback((index: number) => {
    setFeedStartIndex(index);
    setActiveIndex(index);
    setIsPlaying(true);
    setShowOverlay(true);
    setFeedMode(true);
    // Close search bar, autocomplete dropdown, and keyboard so they
    // don't overlay the full-screen feed player.
    setShowSearch(false);
    setShowAutocomplete(false);
    Keyboard.dismiss();
  }, []);

  // Return to grid view from full-screen feed
  const handleExitFeedMode = useCallback(() => {
    setFeedMode(false);
    setIsPlaying(false);
  }, []);

  // ── Scroll to target product when arriving from "See Video" ──────
  // When navigated to /videos?product=<slug>, find that product in the
  // loaded feed and scroll to it so the user sees its video directly.
  const [hasScrolledToTarget, setHasScrolledToTarget] = useState(false);
  useEffect(() => {
    if (targetProductSlug && !loading && products.length > 0 && !hasScrolledToTarget) {
      const idx = products.findIndex((p) => p.slug === targetProductSlug);
      if (idx >= 0) {
        setActiveIndex(idx);
        setIsPlaying(true);
        listRef.current?.scrollToIndex({ index: idx, animated: false });
        setHasScrolledToTarget(true);
      }
    }
  }, [targetProductSlug, loading, products, hasScrolledToTarget]);

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
        url: `https://diilzo.com/products/${product.slug}`,
        title: product.name,
      });
    } catch (e: any) {
      console.error('Share error:', e?.message);
    }
  }, []);

  // ── Recent searches helpers ───────────────────────────────────────
  const saveRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
      AsyncStorage.setItem('video_recent_searches', JSON.stringify(next)).catch(() => { });
      return next;
    });
  }, []);

  const removeRecentSearch = useCallback((term: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((t) => t !== term);
      AsyncStorage.setItem('video_recent_searches', JSON.stringify(next)).catch(() => { });
      return next;
    });
  }, []);

  const handleSubmitSearch = useCallback(() => {
    if (searchQuery.trim()) saveRecentSearch(searchQuery);
    Keyboard.dismiss();
    setShowAutocomplete(false);
  }, [searchQuery, saveRecentSearch]);

  const handleProductPress = useCallback((slug: string) => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery);
      const product = products.find((p) => p.slug === slug);
      logSearchClick(searchQuery.trim(), product?.id, undefined).catch(() => { });
    }
    router.push(`/product/${slug}` as any);
  }, [router, searchQuery, saveRecentSearch, products]);

  // ── Render grid video item (2-column, muted autoplay for search results) ──
  const renderGridVideoItem = useCallback(({ item, index }: { item: Product; index: number }) => {
    const hasDirectVideo = Boolean(item.video_file_url);
    const isWishlisted = wishlistIds.has(item.id);
    const isActive = gridActiveIndices.has(index);

    if (!hasDirectVideo || !item.video_file_url) {
      // Non-video items show thumbnail only — tap goes to product detail
      return (
        <Pressable
          style={styles.gridItem}
          onPress={() => handleProductPress(item.slug)}
        >
          {item.primary_image_url ? (
            <Image source={{ uri: item.primary_image_url }} style={styles.gridThumbnail} resizeMode="cover" />
          ) : (
            <View style={[styles.gridThumbnail, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
              <MaterialCommunityIcons name="package-variant-closed" size={32} color="#444" />
            </View>
          )}
          <View style={styles.gridInfo}>
            <Text style={styles.gridStoreName} numberOfLines={1}>{item.store?.name || 'Diilzo Store'}</Text>
            <Text style={styles.gridProductName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.gridPrice}>{item.currency} {Number(item.final_price).toLocaleString()}</Text>
          </View>
        </Pressable>
      );
    }

    return (
      <View style={styles.gridItem}>
        <GridVideoPlayer
          uri={item.video_file_url}
          isActive={isActive}
          posterImage={item.primary_image_url}
          productName={item.name}
          storeName={item.store?.name || 'Diilzo Store'}
          price={Number(item.final_price)}
          currency={item.currency}
          isOnSale={item.is_on_sale}
          discountPercentage={item.discount_percentage}
          isWishlisted={isWishlisted}
          onPress={() => handleGridVideoPress(index)}
          onWishlistToggle={() => handleWishlistToggle(item)}
        />
      </View>
    );
  }, [gridActiveIndices, wishlistIds, handleProductPress, handleWishlistToggle, handleGridVideoPress]);

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
      <View style={[styles.feedItem, { height: feedMode ? feedModeHeight : feedHeight }]}>
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
              muted={videoMuted}
              onToggleMute={handleToggleMute}
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
            {/* Mute / Unmute */}
            {isActive && hasDirectVideo ? (
              <Pressable style={styles.actionItem} onPress={handleToggleMute}>
                <MaterialCommunityIcons
                  name={videoMuted ? 'volume-mute' : 'volume-high'}
                  size={30}
                  color="#FFFFFF"
                />
                <Text style={styles.actionText}>{videoMuted ? 'Muted' : 'Sound'}</Text>
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
            <Pressable style={styles.actionItem} onPress={() => handleProductPress(item.slug)}>
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
              onPress={() => handleProductPress(item.slug)}
            >
              <MaterialCommunityIcons name="arrow-right-circle" size={20} color="#FFFFFF" />
              <Text style={styles.viewProductText}>View Product</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }, [feedHeight, feedModeHeight, feedMode, activeIndex, isPlaying, showOverlay, videoMuted, wishlistIds, heartBurstIndex, handleVideoEnd, handleOverlayToggle, handleToggleMute, handleWishlistToggle, handleShare, handleProductPress]);

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
      <View style={styles.screen}>
        <LinearGradient colors={[Brand.dark, Brand.accent, Brand.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBg}>
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.headerBar} />
          </SafeAreaView>
        </LinearGradient>
        <View style={[styles.tabsContainer, { borderBottomWidth: 0 }]}>
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
        {showSearch && (
          <View style={styles.searchContainer}>
            <View style={styles.searchBarWrap}>
              <MaterialCommunityIcons name="magnify" size={18} color="rgba(255,255,255,0.6)" />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search product videos..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={handleSubmitSearch}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => { setSearchQuery(''); searchInputRef.current?.focus(); }} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
                </Pressable>
              )}
            </View>
          </View>
        )}
        <View style={styles.centerScreen}>
          <View style={styles.emptyIconWrap}>
            <MaterialCommunityIcons name="play-circle-outline" size={56} color={colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery.trim().length >= 2 ? 'No videos found' : 'No videos yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery.trim().length >= 2
              ? `We couldn't find videos for "${searchQuery}".\nCheck the spelling or try a different term.`
              : activeCategory
                ? 'Try a different category'
                : 'Product videos will appear here'}
          </Text>
          {suggestion && (
            <Pressable
              style={styles.suggestionBtn}
              onPress={() => { setSearchQuery(suggestion); setSuggestion(null); }}
            >
              <MaterialCommunityIcons name="lightbulb-outline" size={16} color="#FFFFFF" />
              <Text style={styles.suggestionBtnText}>Search "{suggestion}" instead</Text>
            </Pressable>
          )}
          {searchQuery.trim().length >= 2 && (
            <Pressable
              style={[styles.suggestionBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
              onPress={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
            >
              <Text style={[styles.suggestionBtnText, { color: '#FFFFFF' }]}>Clear Search</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* ── Gradient spacer for status bar (hidden in feed mode) ─────── */}
      {!feedMode && (
        <LinearGradient colors={[Brand.dark, Brand.accent, Brand.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBg}>
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.headerBar} />
          </SafeAreaView>
        </LinearGradient>
      )}

      {/* ── Category tabs (hidden in full-screen feed mode) ─────────── */}
      {!feedMode && (
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
      )}

      {/* Search bar (collapsible) */}
      {showSearch && !feedMode && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBarWrap}>
            <MaterialCommunityIcons name="magnify" size={18} color="rgba(255,255,255,0.6)" />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search product videos..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSubmitSearch}
              onFocus={() => { if (autocompleteItems.length > 0) setShowAutocomplete(true); }}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                hitSlop={8}
              >
                <MaterialCommunityIcons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
              </Pressable>
            )}
          </View>

          {/* Autocomplete dropdown */}
          {showAutocomplete && autocompleteItems.length > 0 && (
            <View style={styles.autocompleteDropdown}>
              {autocompleteItems.map((item, idx) => (
                <Pressable
                  key={`ac-${idx}`}
                  style={styles.autocompleteItem}
                  onPress={() => {
                    setSearchQuery(item);
                    setShowAutocomplete(false);
                  }}
                >
                  <MaterialCommunityIcons name="magnify" size={16} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.autocompleteText} numberOfLines={1}>{item}</Text>
                  <MaterialCommunityIcons name="arrow-top-left" size={14} color="rgba(255,255,255,0.4)" />
                </Pressable>
              ))}
            </View>
          )}

          {/* Recent + trending searches (shown when query is empty) */}
          {searchQuery.trim().length === 0 && (recentSearches.length > 0 || trendingSearches.length > 0) && (
            <View style={styles.searchSuggestions}>
              {recentSearches.length > 0 && (
                <View style={styles.suggestionSection}>
                  <View style={styles.suggestionHeader}>
                    <MaterialCommunityIcons name="history" size={14} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.suggestionTitle}>Recent</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionChips}>
                    {recentSearches.map((term) => (
                      <Pressable
                        key={`recent-${term}`}
                        style={styles.suggestionChip}
                        onPress={() => setSearchQuery(term)}
                      >
                        <Text style={styles.suggestionChipText} numberOfLines={1}>{term}</Text>
                        <Pressable onPress={() => removeRecentSearch(term)} hitSlop={6}>
                          <MaterialCommunityIcons name="close" size={12} color="rgba(255,255,255,0.4)" />
                        </Pressable>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
              {trendingSearches.length > 0 && (
                <View style={styles.suggestionSection}>
                  <View style={styles.suggestionHeader}>
                    <MaterialCommunityIcons name="fire" size={14} color={Brand.danger} />
                    <Text style={styles.suggestionTitle}>Trending</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionChips}>
                    {trendingSearches.map((term) => (
                      <Pressable
                        key={`trending-${term}`}
                        style={styles.suggestionChip}
                        onPress={() => setSearchQuery(term)}
                      >
                        <Text style={styles.suggestionChipText} numberOfLines={1}>{term}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* "Did you mean" suggestion */}
          {suggestion && (
            <Pressable
              style={styles.didYouMeanBar}
              onPress={() => { setSearchQuery(suggestion); setSuggestion(null); }}
            >
              <MaterialCommunityIcons name="lightbulb-outline" size={14} color={Brand.rating} />
              <Text style={styles.didYouMeanText}>
                Did you mean <Text style={styles.didYouMeanLink}>"{suggestion}"</Text>?
              </Text>
            </Pressable>
          )}

          {/* Search result count */}
          {searchQuery.trim().length >= 2 && products.length > 0 && (
            <Text style={styles.searchCountText}>
              {searchCount > 0 ? `${searchCount} videos for ` : ''}"{searchQuery}"
            </Text>
          )}
        </View>
      )}

      {/* ── Full-screen TikTok feed (browse mode OR feed mode from grid tap) ─ */}
      {feedMode || searchQuery.trim().length < 2 ? (
        <>
          <FlatList
            key="feed"
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
            initialScrollIndex={feedMode ? Math.min(feedStartIndex, products.length - 1) : 0}
            getItemLayout={(_, index) => ({
              length: feedMode ? feedModeHeight : feedHeight,
              offset: (feedMode ? feedModeHeight : feedHeight) * index,
              index,
            })}
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

          {/* Back button to return to grid (feed mode only) */}
          {feedMode && (
            <Pressable style={styles.feedBackBtn} onPress={handleExitFeedMode} hitSlop={12}>
              <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
              <Text style={styles.feedBackText}>Grid</Text>
            </Pressable>
          )}

          {/* Progress indicator */}
          <View style={styles.progressWrap}>
            <Text style={styles.progressText}>{activeIndex + 1} / {products.length}</Text>
          </View>
        </>
      ) : (
        /* ── Search results: 2-column grid with muted autoplay ─────────── */
        <FlatList
          key={`grid-${productColumns}`}
          ref={gridListRef}
          data={products}
          keyExtractor={(item) => `grid-video-${item.id}-${item.slug}`}
          renderItem={renderGridVideoItem}
          extraData={Array.from(gridActiveIndices).join(',')}
          numColumns={productColumns}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={isTablet ? styles.tabletGridContent : styles.gridContent}
          columnWrapperStyle={isTablet ? styles.tabletGridRow : styles.gridRow}
          onViewableItemsChanged={handleGridViewableItemsChanged}
          viewabilityConfig={gridViewabilityConfig}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          maxToRenderPerBatch={6}
          windowSize={7}
          initialNumToRender={6}
          removeClippedSubviews
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
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  centerScreen: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  safeArea: { flex: 0, backgroundColor: 'transparent' },
  headerBg: { width: '100%' },
  headerBar: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: { marginTop: 8, color: c.textTertiary, fontSize: 14 },
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
  emptySubtext: { marginTop: 8, fontSize: 14, color: c.textTertiary, textAlign: 'center' },
  suggestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Brand.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
  },
  suggestionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

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
  searchContainer: {
    backgroundColor: '#0a0a0a',
    paddingBottom: 4,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#FFFFFF', padding: 0 },

  // ── Autocomplete dropdown ────────────────────────────────────────
  autocompleteDropdown: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  autocompleteText: { flex: 1, color: 'rgba(255,255,255,0.9)', fontSize: 13 },

  // ── Search suggestions (recent + trending) ────────────────────────
  searchSuggestions: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  suggestionSection: { marginBottom: 8 },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  suggestionTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  suggestionChips: { gap: 6 },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  suggestionChipText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, maxWidth: 120 },

  // ── "Did you mean" bar ────────────────────────────────────────────
  didYouMeanBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251,191,36,0.1)',
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  didYouMeanText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  didYouMeanLink: { color: Brand.rating, fontWeight: '700' },

  // ── Search count ─────────────────────────────────────────────────
  searchCountText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },

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

  // ── Feed back button (return to grid from full-screen feed) ──────
  feedBackBtn: {
    position: 'absolute',
    top: 60,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
  },
  feedBackText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  // ── Footer loading ──────────────────────────────────────────────
  footerLoading: { paddingVertical: 20, alignItems: 'center' },

  // ── Grid (search results — 2-column muted autoplay) ──────────────
  gridContent: { paddingHorizontal: 8, paddingBottom: 100 },
  tabletGridContent: { paddingHorizontal: 24, paddingBottom: 32 },
  gridRow: { gap: 8, marginBottom: 8 },
  tabletGridRow: { gap: 16, marginBottom: 16 },
  gridItem: {
    flex: 1,
    aspectRatio: 9 / 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  gridThumbnail: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    width: '100%', height: '100%',
  },
  gridInfo: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  gridStoreName: { color: Brand.primary, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  gridProductName: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', lineHeight: 16, marginBottom: 4 },
  gridPrice: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
