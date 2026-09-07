import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { fetchStoreBySlug, fetchStoreProducts, followStore, unfollowStore } from '@/services/catalog';
import { createChatThread } from '@/services/chat';
import type { PaginatedResponse, Product, StoreDetail } from '@/types';

const BUSINESS_ICONS: Record<string, string> = {
  manufacturer: 'factory',
  wholesaler: 'warehouse',
  distributor: 'truck-delivery',
  trading_company: 'swap-horizontal',
  retailer: 'store',
  individual: 'account',
};

export default function StoreDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const { isAuthenticated } = useAuth();

  const load = useCallback(async (reset = false) => {
    if (!slug) return;
    const targetPage = reset ? 1 : page;
    if (reset) {
      setPage(1);
      setHasMore(true);
    }
    try {
      if (reset) {
        setRefreshing(true);
        if (!store) {
          const storeData = await fetchStoreBySlug(slug);
          setStore(storeData);
        }
      } else {
        setLoadingMore(true);
      }
      const data: PaginatedResponse<Product> = await fetchStoreProducts(slug, targetPage);
      setProducts((prev) => (reset ? data.results : [...prev, ...data.results]));
      setHasMore(data.next !== null);
      if (!reset) setPage(targetPage + 1);
    } catch (e: any) {
      setError(e?.message || 'Failed to load store');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [slug, page, store]);

  useEffect(() => {
    load(true);
  }, []);

  const handleFollow = useCallback(async () => {
    if (!store?.slug) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    try {
      if (isFollowing) {
        await unfollowStore(store.slug);
        setIsFollowing(false);
      } else {
        await followStore(store.slug);
        setIsFollowing(true);
      }
    } catch (e: any) {
      console.error('Follow error:', e?.message);
    }
  }, [store, isFollowing, isAuthenticated, router]);

  const handleContact = useCallback(async () => {
    if (!store?.slug) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    try {
      const thread = await createChatThread(store.slug);
      router.push(`/chat/${thread.id}` as any);
    } catch (e: any) {
      console.error('Chat create error:', e?.message);
    }
  }, [store, isAuthenticated, router]);

  const onRefresh = useCallback(() => load(true), [load]);
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || refreshing) return;
    load(false);
  }, [hasMore, loadingMore, refreshing, load]);

  // ── Loading ─────────────────────────────────────────────────────
  if (loading && !store) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <LinearGradient
            colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.topBar}
          >
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.topBarTitle}>Store</Text>
            <View style={{ width: 24 }} />
          </LinearGradient>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.centerText}>Loading store...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Error ───────────────────────────────────────────────────────
  if (error || !store) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <LinearGradient
            colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.topBar}
          >
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.topBarTitle}>Store</Text>
            <View style={{ width: 24 }} />
          </LinearGradient>
          <View style={styles.center}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorTitle}>{error || 'Store not found'}</Text>
            <Pressable style={styles.retryBtn} onPress={() => router.back()}>
              <Text style={styles.retryText}>Go Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const isSupplier = store.is_wholesaler;
  const icon = BUSINESS_ICONS[store.business_type || 'individual'] || 'store';
  const iconName = icon as any;
  const rating = store.rating ? parseFloat(store.rating) : 0;

  const renderProduct = ({ item }: { item: Product }) => (
    <Pressable
      style={({ pressed }) => [styles.productCard, pressed && { opacity: 0.9 }]}
      onPress={() => router.push(`/product/${item.slug}`)}
    >
      <View style={styles.productImageWrap}>
        {item.primary_image_url ? (
          <Image source={{ uri: item.primary_image_url }} style={styles.productImage} contentFit="contain" />
        ) : (
          <View style={styles.noImage}>
            <MaterialCommunityIcons name="package-variant-closed" size={32} color={Brand.textTertiary} />
          </View>
        )}
        {item.is_on_sale && (
          <View style={styles.saleBadge}>
            <Text style={styles.saleBadgeText}>-{Math.round(item.discount_percentage || 0)}%</Text>
          </View>
        )}
      </View>
      <View style={styles.productBody}>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.productPriceRow}>
          <Text style={styles.productCurrency}>{item.currency}</Text>
          <Text style={styles.productPrice}>{Number(item.final_price).toLocaleString()}</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* ── Top bar ─────────────────────────────────────────────── */}
        <LinearGradient
          colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.topBar}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.topBarTitle} numberOfLines={1}>{isSupplier ? 'Supplier' : 'Store'}</Text>
          <Pressable hitSlop={12}>
            <MaterialCommunityIcons name="share-variant-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>

        <FlatList
          data={products}
          keyExtractor={(item, index) => `${item.id}-${item.slug}-${index}`}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          contentContainerStyle={styles.list}
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
          ListHeaderComponent={
            <View>
              {/* ── Hero banner ────────────────────────────────────── */}
              <LinearGradient
                colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroBanner}
              >
                <View style={styles.heroContent}>
                  <View style={styles.heroLogoWrap}>
                    {store.logo_url ? (
                      <Image source={{ uri: store.logo_url }} style={styles.heroLogo} contentFit="contain" />
                    ) : (
                      <View style={styles.heroLogoFallback}>
                        <MaterialCommunityIcons name={isSupplier ? 'factory' : 'store'} size={36} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                  <View style={styles.heroInfo}>
                    <Text style={styles.heroName}>{store.name}</Text>
                    {store.tagline ? (
                      <Text style={styles.heroTagline} numberOfLines={2}>{store.tagline}</Text>
                    ) : null}
                    <View style={styles.heroMetaRow}>
                      <MaterialCommunityIcons name="star" size={14} color={Brand.accent} />
                      <Text style={styles.heroMetaText}>{rating.toFixed(1)}</Text>
                      <Text style={styles.heroMetaSub}>({store.review_count || 0})</Text>
                      <Text style={styles.heroMetaDot}>•</Text>
                      <MaterialCommunityIcons name="package-variant-closed" size={14} color="#FFFFFF" />
                      <Text style={styles.heroMetaText}>{store.product_count} products</Text>
                    </View>
                    <View style={styles.heroMetaRow}>
                      <MaterialCommunityIcons name="map-marker" size={14} color="#FFFFFF" />
                      <Text style={styles.heroMetaText}>{store.city}, {store.country}</Text>
                    </View>
                  </View>
                </View>

                {/* Badges */}
                <View style={styles.heroBadges}>
                  {store.verification_status === 'gold' && (
                    <View style={[styles.heroBadge, styles.heroBadgeGold]}>
                      <MaterialCommunityIcons name="crown" size={12} color="#FFFFFF" />
                      <Text style={styles.heroBadgeText}>Gold Supplier</Text>
                    </View>
                  )}
                  {store.verification_status === 'verified' && (
                    <View style={[styles.heroBadge, styles.heroBadgeVerified]}>
                      <MaterialCommunityIcons name="check-circle" size={12} color="#FFFFFF" />
                      <Text style={styles.heroBadgeText}>Verified</Text>
                    </View>
                  )}
                  {isSupplier && (
                    <View style={[styles.heroBadge, styles.heroBadgeType]}>
                      <MaterialCommunityIcons name={iconName} size={12} color="#FFFFFF" />
                      <Text style={styles.heroBadgeText}>
                        {store.business_type ? store.business_type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Wholesaler'}
                      </Text>
                    </View>
                  )}
                  {isSupplier && (
                    <View style={[styles.heroBadge, styles.heroBadgeTA]}>
                      <MaterialCommunityIcons name="shield-check" size={12} color="#FFFFFF" />
                      <Text style={styles.heroBadgeText}>Trade Assurance</Text>
                    </View>
                  )}
                </View>
              </LinearGradient>

              {/* ── Action buttons ─────────────────────────────────── */}
              <View style={styles.actionsRow}>
                <Pressable style={styles.actionBtn} onPress={handleContact}>
                  <MaterialCommunityIcons name="chat-outline" size={20} color={Brand.primary} />
                  <Text style={styles.actionBtnText}>Contact</Text>
                </Pressable>
                {isSupplier && (
                  <Pressable style={styles.actionBtn}>
                    <MaterialCommunityIcons name="file-document-outline" size={20} color={Brand.primary} />
                    <Text style={styles.actionBtnText}>Request Quote</Text>
                  </Pressable>
                )}
                <Pressable style={styles.actionBtn} onPress={handleFollow}>
                  <MaterialCommunityIcons name={isFollowing ? 'heart' : 'heart-outline'} size={20} color={Brand.danger} />
                  <Text style={styles.actionBtnText}>{isFollowing ? 'Following' : 'Follow'}</Text>
                </Pressable>
              </View>

              {/* ── About section ──────────────────────────────────── */}
              {store.description ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>About {store.name}</Text>
                  <Text style={styles.descText}>{store.description}</Text>
                </View>
              ) : null}

              {/* ── Store info ─────────────────────────────────────── */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Store Information</Text>
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="map-marker" size={16} color={Brand.textSecondary} />
                  <Text style={styles.infoText}>{store.city}, {store.country}</Text>
                </View>
                {store.phone ? (
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="phone" size={16} color={Brand.textSecondary} />
                    <Text style={styles.infoText}>{store.phone}</Text>
                  </View>
                ) : null}
                {store.email ? (
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="email" size={16} color={Brand.textSecondary} />
                    <Text style={styles.infoText}>{store.email}</Text>
                  </View>
                ) : null}
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="calendar" size={16} color={Brand.textSecondary} />
                  <Text style={styles.infoText}>
                    Member since {new Date(store.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              </View>

              {/* ── Products header ────────────────────────────────── */}
              <View style={styles.productsHeader}>
                <MaterialCommunityIcons name="view-grid" size={20} color={Brand.primary} />
                <Text style={styles.productsTitle}>Products ({store.product_count})</Text>
              </View>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={Brand.primary} style={styles.footer} />
            ) : !hasMore ? (
              <Text style={styles.endText}>No more products</Text>
            ) : null
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },

  // ── Top bar ─────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topBarTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', flex: 1, textAlign: 'center' },

  // ── Hero ────────────────────────────────────────────────────────
  heroBanner: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  heroContent: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  heroLogoWrap: {
    width: 70, height: 70, borderRadius: 12, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroLogo: { width: '100%', height: '100%' },
  heroLogoFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroInfo: { flex: 1, gap: 4 },
  heroName: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  heroTagline: { fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 18 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroMetaText: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },
  heroMetaSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  heroMetaDot: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },

  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  heroBadgeGold: { backgroundColor: Brand.accent },
  heroBadgeVerified: { backgroundColor: '#16A34A' },
  heroBadgeType: { backgroundColor: 'rgba(255,255,255,0.3)' },
  heroBadgeTA: { backgroundColor: 'rgba(255,255,255,0.3)' },
  heroBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  // ── Actions ─────────────────────────────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.surfaceAlt,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surfaceAlt,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },

  // ── Section cards ───────────────────────────────────────────────
  sectionCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.surfaceAlt,
    gap: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Brand.text },
  descText: { fontSize: 13, lineHeight: 20, color: Brand.textSecondary },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, color: Brand.textSecondary },

  // ── Products ────────────────────────────────────────────────────
  productsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.surfaceAlt,
  },
  productsTitle: { fontSize: 15, fontWeight: '700', color: Brand.text },
  list: { paddingBottom: 20 },
  productRow: { gap: 10, marginBottom: 10, paddingHorizontal: 16 },
  productCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Brand.surfaceAlt,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  productImageWrap: { position: 'relative', backgroundColor: Brand.surfaceAlt, aspectRatio: 1 },
  productImage: { width: '100%', height: '100%' },
  noImage: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.surfaceAlt },
  saleBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: Brand.danger, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  saleBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  productBody: { padding: 10, gap: 4 },
  productName: { fontSize: 13, fontWeight: '600', lineHeight: 18, color: Brand.text },
  productPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  productCurrency: { fontSize: 11, fontWeight: '600', color: Brand.text },
  productPrice: { fontSize: 16, fontWeight: '700', color: Brand.text },

  // ── States ──────────────────────────────────────────────────────
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  centerText: { marginTop: 8, color: Brand.textSecondary, fontSize: 14 },
  errorTitle: { marginTop: 8, marginBottom: 12, fontSize: 16, fontWeight: '700', color: Brand.danger, textAlign: 'center' },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  footer: { paddingVertical: 16 },
  endText: { textAlign: 'center', paddingVertical: 16, color: Brand.textTertiary, fontSize: 13 },
});
