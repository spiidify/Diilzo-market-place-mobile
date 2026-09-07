import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import YoutubePlayer from 'react-native-youtube-iframe';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { fetchProductVideos, getYouTubeId, getYouTubeThumbnail } from '@/services/videos';
import type { Product } from '@/types';

export default function VideosScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchProductVideos(1);
      setProducts(data.results);
    } catch (e: any) {
      console.error('Video fetch error:', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentProduct = products[activeIndex];
  const currentVideoId = currentProduct ? getYouTubeId(currentProduct.video_url || '') : null;

  // ── Loading state ───────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color={Brand.primary} />
        <Text style={styles.loadingText}>Loading videos...</Text>
      </View>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────
  if (products.length === 0) {
    return (
      <View style={styles.centerScreen}>
        <View style={styles.emptyIconWrap}>
          <MaterialCommunityIcons name="play-circle-outline" size={56} color={Brand.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>No videos yet</Text>
        <Text style={styles.emptySubtext}>Product videos will appear here</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* ── Full-screen video player modal ────────────────────────── */}
      <Modal
        visible={playingId !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setPlayingId(null)}
      >
        <View style={styles.modalScreen}>
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setPlayingId(null)} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {currentProduct?.name || 'Product Video'}
              </Text>
              <View style={{ width: 28 }} />
            </View>
            <View style={styles.playerWrap}>
              {playingId && (
                <YoutubePlayer
                  videoId={playingId}
                  height="100%"
                  play
                  onChangeState={(e: string) => {
                    if (e === 'ended') setPlayingId(null);
                  }}
                  webViewProps={{
                    injectedJavaScript: `
                      var element = document.getElementsByClassName('container')[0];
                      element.style.position = 'absolute';
                      element.style.top = '50%';
                      element.style.left = '50%';
                      element.style.transform = 'translate(-50%, -50%)';
                      true;
                    `,
                  }}
                />
              )}
            </View>
            {/* Product info below video */}
            {currentProduct && (
              <View style={styles.modalProductInfo}>
                <Text style={styles.modalProductName} numberOfLines={2}>{currentProduct.name}</Text>
                <View style={styles.modalPriceRow}>
                  <Text style={styles.modalCurrency}>{currentProduct.currency} </Text>
                  <Text style={styles.modalPrice}>{Number(currentProduct.final_price).toLocaleString()}</Text>
                </View>
                <Pressable
                  style={styles.modalViewBtn}
                  onPress={() => {
                    setPlayingId(null);
                    router.push(`/product/${currentProduct.slug}` as any);
                  }}
                >
                  <Text style={styles.modalViewBtnText}>View Product</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── TikTok-style vertical feed ────────────────────────────── */}
      <View style={styles.feedContainer}>
        {products.map((product, index) => {
          const videoId = getYouTubeId(product.video_url || '');
          const thumb = videoId ? getYouTubeThumbnail(videoId) : product.primary_image_url;
          const isActive = index === activeIndex;

          return (
            <View
              key={`${product.id}-${product.slug}`}
              style={[styles.feedItem, { display: isActive ? 'flex' : 'none' }]}
            >
              {/* Background thumbnail */}
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.thumbnail} contentFit="contain" />
              ) : (
                <View style={styles.thumbnailFallback} />
              )}
              {/* Dark overlay */}
              <View style={styles.overlay} />

              {/* Play button */}
              <Pressable
                style={styles.playBtn}
                onPress={() => {
                  setActiveIndex(index);
                  if (videoId) setPlayingId(videoId);
                }}
              >
                <MaterialCommunityIcons name="play-circle" size={72} color="rgba(255,255,255,0.9)" />
              </Pressable>

              {/* Right action bar (TikTok-style) */}
              <View style={styles.actionBar}>
                <View style={styles.actionAvatar}>
                  {product.store?.logo_url ? (
                    <Image source={{ uri: product.store.logo_url }} style={styles.storeAvatar} contentFit="contain" />
                  ) : (
                    <View style={styles.storeAvatarFallback}>
                      <MaterialCommunityIcons name="store" size={18} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <Pressable style={styles.actionItem} onPress={() => router.push(`/product/${product.slug}` as any)}>
                  <MaterialCommunityIcons name="shopping" size={30} color="#FFFFFF" />
                  <Text style={styles.actionText}>Buy</Text>
                </Pressable>
                <View style={styles.actionItem}>
                  <MaterialCommunityIcons name="star" size={30} color={Brand.rating} />
                  <Text style={styles.actionText}>{product.rating ? parseFloat(product.rating).toFixed(1) : '0.0'}</Text>
                </View>
                <View style={styles.actionItem}>
                  <MaterialCommunityIcons name="package-variant-closed" size={30} color="#FFFFFF" />
                  <Text style={styles.actionText}>{product.stock_quantity}</Text>
                </View>
              </View>

              {/* Bottom product info */}
              <View style={styles.bottomInfo}>
                <Text style={styles.storeName} numberOfLines={1}>
                  {product.store?.name || 'Diilzo Store'}
                </Text>
                <Text style={styles.productName} numberOfLines={2}>
                  {product.name}
                </Text>
                {product.short_description ? (
                  <Text style={styles.description} numberOfLines={2}>
                    {product.short_description}
                  </Text>
                ) : null}
                <View style={styles.priceRow}>
                  <Text style={styles.currency}>{product.currency} </Text>
                  <Text style={styles.price}>{Number(product.final_price).toLocaleString()}</Text>
                  {product.is_on_sale && (
                    <View style={styles.saleTag}>
                      <Text style={styles.saleTagText}>{product.discount_percentage}% OFF</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  style={styles.viewProductBtn}
                  onPress={() => router.push(`/product/${product.slug}` as any)}
                >
                  <MaterialCommunityIcons name="arrow-right-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.viewProductText}>View Product</Text>
                </Pressable>
              </View>

              {/* Navigation arrows */}
              <View style={styles.navArrows}>
                {index > 0 && (
                  <Pressable
                    style={styles.navUp}
                    onPress={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
                  >
                    <MaterialCommunityIcons name="chevron-up" size={32} color="rgba(255,255,255,0.6)" />
                  </Pressable>
                )}
                {index < products.length - 1 && (
                  <Pressable
                    style={styles.navDown}
                    onPress={() => setActiveIndex((prev) => Math.min(products.length - 1, prev + 1))}
                  >
                    <MaterialCommunityIcons name="chevron-down" size={32} color="rgba(255,255,255,0.6)" />
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </View>

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
  emptySubtext: { marginTop: 8, fontSize: 14, color: Brand.textTertiary },

  // ── Feed ────────────────────────────────────────────────────────
  feedContainer: { flex: 1 },
  feedItem: { flex: 1, position: 'relative' },
  thumbnail: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  thumbnailFallback: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1a1a1a' },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  // ── Play button ─────────────────────────────────────────────────
  playBtn: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -36,
    marginLeft: -36,
  },

  // ── Action bar (right side, TikTok-style) ───────────────────────
  actionBar: {
    position: 'absolute',
    right: 12,
    bottom: 160,
    alignItems: 'center',
    gap: 20,
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
    right: 80,
    padding: 16,
    paddingBottom: 24,
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

  // ── Navigation arrows ───────────────────────────────────────────
  navArrows: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -40 }],
    gap: 8,
  },
  navUp: {}, navDown: { marginTop: 80 },

  // ── Progress ────────────────────────────────────────────────────
  progressWrap: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 12,
  },
  progressText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  // ── Modal ───────────────────────────────────────────────────────
  modalScreen: { flex: 1, backgroundColor: '#000000' },
  modalSafeArea: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalTitle: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  playerWrap: { flex: 1, justifyContent: 'center' },
  modalProductInfo: { padding: 16, paddingBottom: 32 },
  modalProductName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  modalPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 16 },
  modalCurrency: { color: Brand.primary, fontSize: 16, fontWeight: '700' },
  modalPrice: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  modalViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Brand.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalViewBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
