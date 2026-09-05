import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { addToCart, getCartCount } from '@/services/cart';
import { fetchProductReviews, trackProductView } from '@/services/catalog';
import { createChatThread } from '@/services/chat';
import { fetchProductBySlug } from '@/services/products';
import { addToWishlist, checkWishlist, removeFromWishlist } from '@/services/wishlist';
import type { Product, Review } from '@/types';

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const { isAuthenticated } = useAuth();

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProductBySlug(slug);
      setProduct(data);
      setQuantity(data.min_order_quantity || 1);
      fetchProductReviews(slug).then(setReviews).catch(() => { });
      trackProductView(slug).catch(() => { });
      if (isAuthenticated && data.id) {
        checkWishlist(data.id).then((r: any) => setIsWishlisted(!!r.is_wishlisted)).catch(() => { });
        getCartCount().then(setCartCount).catch(() => { });
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [slug, isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  const handleWishlist = useCallback(async () => {
    if (!product) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    try {
      if (isWishlisted) {
        await removeFromWishlist(product.id);
        setIsWishlisted(false);
      } else {
        await addToWishlist(product.id);
        setIsWishlisted(true);
      }
    } catch (e: any) {
      console.error('Wishlist error:', e?.message);
    }
  }, [product, isWishlisted, isAuthenticated, router]);

  const handleChat = useCallback(async () => {
    if (!product?.store?.slug) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    try {
      const thread = await createChatThread(product.store.slug, product.id);
      router.push(`/chat/${thread.id}` as any);
    } catch (e: any) {
      console.error('Chat create error:', e?.message);
    }
  }, [product, isAuthenticated, router]);

  const handleAddToCart = useCallback(async () => {
    if (!product) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    try {
      await addToCart(product.id, quantity);
      const count = await getCartCount();
      setCartCount(count);
    } catch (e: any) {
      console.error('Add to cart error:', e?.message);
    }
  }, [product, quantity, isAuthenticated, router]);

  const handleShare = useCallback(async () => {
    if (!product) return;
    try {
      await Share.share({
        message: `Check out ${product.name} on Diilzo — ${product.currency} ${Number(product.final_price).toLocaleString()}`,
        url: `https://diilzo-market-place-production.up.railway.app/products/${product.slug}`,
        title: product.name,
      });
    } catch (e: any) {
      console.error('Share error:', e?.message);
    }
  }, [product]);

  // Track recently viewed
  useEffect(() => {
    if (!product) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('recently_viewed');
        const list: any[] = raw ? JSON.parse(raw) : [];
        const filtered = list.filter((p: any) => p.slug !== product.slug);
        filtered.unshift({ id: product.id, slug: product.slug, name: product.name, primary_image_url: product.primary_image_url, final_price: product.final_price, currency: product.currency });
        await AsyncStorage.setItem('recently_viewed', JSON.stringify(filtered.slice(0, 20)));
      } catch { }
    })();
  }, [product]);

  // ── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <LinearGradient
            colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.topBar}
          >
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.topBarTitle}>Product Details</Text>
            <View style={{ width: 24 }} />
          </LinearGradient>
        </SafeAreaView>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
          <Text style={styles.centerText}>Loading product...</Text>
        </View>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────
  if (error || !product) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <LinearGradient
            colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.topBar}
          >
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.topBarTitle}>Product Details</Text>
            <View style={{ width: 24 }} />
          </LinearGradient>
        </SafeAreaView>
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
          <Text style={styles.errorTitle}>{error || 'Product not found'}</Text>
          <Pressable style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const rating = parseFloat(product.rating) || 0;
  const reviewCount = product.review_count ?? 0;
  const images = product.images?.length
    ? product.images.map((img) => img.image_url).filter(Boolean) as string[]
    : product.primary_image_url ? [product.primary_image_url] : [];
  const savings = product.is_on_sale ? Number(product.price) - Number(product.final_price) : 0;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* ── Top bar (orange gradient) ──────────────────────────── */}
        <LinearGradient
          colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.topBar}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.topBarTitle} numberOfLines={1}>Product Details</Text>
          <Pressable hitSlop={12} onPress={handleShare}>
            <MaterialCommunityIcons name="share-variant-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Image gallery ──────────────────────────────────────── */}
          <View style={styles.gallerySection}>
            <View style={styles.mainImageWrap}>
              {images.length > 0 ? (
                <Image
                  source={{ uri: images[activeImage] }}
                  style={styles.mainImage}
                  contentFit="contain"
                  transition={150}
                />
              ) : (
                <View style={styles.noImage}>
                  <MaterialCommunityIcons name="image-off" size={56} color={Brand.textTertiary} />
                </View>
              )}
              {/* Badges */}
              <View style={styles.badgeStack}>
                {product.is_on_sale && (
                  <View style={[styles.badge, styles.badgeSale]}><Text style={styles.badgeText}>SALE</Text></View>
                )}
                {product.is_new_arrival && (
                  <View style={[styles.badge, styles.badgeNew]}><Text style={styles.badgeText}>NEW</Text></View>
                )}
              </View>
            </View>
            {images.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
                {images.map((img, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => setActiveImage(idx)}
                    style={[styles.thumb, activeImage === idx && styles.thumbActive]}
                  >
                    <Image source={{ uri: img }} style={styles.thumbImg} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          {/* ── Title + price section (compact, Alibaba-style) ─────── */}
          <View style={styles.titleSection}>
            {/* Price — prominent, Alibaba-style */}
            <View style={styles.priceBlock}>
              {product.is_on_sale && (
                <Text style={styles.oldPrice}>
                  {product.currency} {Number(product.price).toLocaleString()}
                </Text>
              )}
              <View style={styles.priceMainRow}>
                <Text style={styles.priceCurrency}>{product.currency}</Text>
                <Text style={[styles.priceAmount, product.is_on_sale && { color: Brand.danger }]}>
                  {Number(product.final_price).toLocaleString()}
                </Text>
                {product.is_on_sale && product.discount_percentage > 0 && (
                  <View style={styles.discountTag}>
                    <Text style={styles.discountTagText}>-{Math.round(product.discount_percentage)}%</Text>
                  </View>
                )}
              </View>
              {product.is_on_sale && savings > 0 && (
                <Text style={styles.saveLine}>
                  Save {product.currency} {savings.toLocaleString()}
                </Text>
              )}
            </View>

            {/* Product name */}
            <Text style={styles.productName}>{product.name}</Text>

            {/* Rating + stock in one row */}
            <View style={styles.metaLine}>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <MaterialCommunityIcons
                    key={i}
                    name={i <= Math.round(rating) ? 'star' : 'star-outline'}
                    size={14}
                    color={Brand.rating}
                  />
                ))}
              </View>
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              <Text style={styles.reviewText}>({reviewCount})</Text>
              <View style={styles.dividerDot} />
              <MaterialCommunityIcons
                name={product.is_in_stock ? 'check-circle' : 'close-circle'}
                size={14}
                color={product.is_in_stock ? Brand.success : Brand.danger}
              />
              <Text style={[styles.stockText, { color: product.is_in_stock ? Brand.success : Brand.danger }]}>
                {product.is_in_stock ? 'In Stock' : 'Out of Stock'}
              </Text>
            </View>

            {/* Brand / category / SKU tags */}
            <View style={styles.tagsRow}>
              {product.brand && (
                <View style={styles.tag}><Text style={styles.tagText}>{product.brand.name}</Text></View>
              )}
              {product.category && (
                <View style={styles.tag}><Text style={styles.tagText}>{product.category.name}</Text></View>
              )}
              {product.is_featured && (
                <View style={[styles.tag, styles.tagChoice]}><Text style={styles.tagChoiceText}>✓ Choice</Text></View>
              )}
            </View>
          </View>

          {/* ── Wishlist + Chat actions ─────────────────────────────── */}
          <View style={styles.actionsRow}>
            <Pressable style={styles.actionChip} onPress={handleWishlist}>
              <MaterialCommunityIcons name={isWishlisted ? 'heart' : 'heart-outline'} size={18} color={Brand.danger} />
              <Text style={styles.actionChipText}>{isWishlisted ? 'In Wishlist' : 'Add to Wishlist'}</Text>
            </Pressable>
            <Pressable style={styles.actionChip} onPress={handleChat}>
              <MaterialCommunityIcons name="chat-outline" size={18} color={Brand.link} />
              <Text style={styles.actionChipText}>Chat with Seller</Text>
            </Pressable>
          </View>

          {/* ── Quantity + delivery (compact row) ──────────────────── */}
          <View style={styles.qtyDeliveryCard}>
            <View style={styles.qtyRow}>
              <Text style={styles.qtyLabel}>Qty</Text>
              <View style={styles.qtyControls}>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={() => setQuantity((q) => Math.max(product.min_order_quantity || 1, q - 1))}
                >
                  <MaterialCommunityIcons name="minus" size={16} color={Brand.textSecondary} />
                </Pressable>
                <Text style={styles.qtyValue}>{quantity}</Text>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={() => setQuantity((q) => Math.min(product.stock_quantity, q + 1))}
                >
                  <MaterialCommunityIcons name="plus" size={16} color={Brand.textSecondary} />
                </Pressable>
              </View>
            </View>
            <View style={styles.deliveryMiniRow}>
              <MaterialCommunityIcons name="truck-fast" size={16} color={Brand.success} />
              <Text style={styles.deliveryMiniText}>Free delivery over 100K</Text>
            </View>
            <View style={styles.deliveryMiniRow}>
              <MaterialCommunityIcons name="undo-variant" size={16} color={Brand.primary} />
              <Text style={styles.deliveryMiniText}>7-day returns</Text>
            </View>
          </View>

          {/* ── Wholesale tiers (compact) ──────────────────────────── */}
          {product.wholesale_tiers && product.wholesale_tiers.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Bulk Pricing</Text>
              {product.wholesale_tiers.map((tier, idx) => (
                <View key={idx} style={styles.tierRow}>
                  <Text style={styles.tierQty}>{tier.min_quantity}+ units</Text>
                  <Text style={styles.tierPrice}>{product.currency} {Number(tier.price).toLocaleString()}</Text>
                </View>
              ))}
              {product.min_order_quantity > 1 && (
                <Text style={styles.moqHint}>Min order: {product.min_order_quantity} units</Text>
              )}
            </View>
          )}

          {/* ── Description (compact) ──────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Description</Text>
            <Text style={styles.descText} numberOfLines={6}>
              {product.description || product.short_description || 'Description coming soon.'}
            </Text>
          </View>

          {/* ── Key features (compact list) ─────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Key Features</Text>
            {[
              product.short_description || product.name,
              `Sold by ${product.store?.name || 'Diilzo'}`,
              product.brand ? `Brand: ${product.brand.name}` : null,
              product.is_in_stock ? `${product.stock_quantity} in stock` : 'Out of stock',
              'Buyer protection & easy returns',
            ].filter(Boolean).map((feat, idx) => (
              <View key={idx} style={styles.featureRow}>
                <MaterialCommunityIcons name="check-circle" size={14} color={Brand.success} />
                <Text style={styles.featureText}>{feat}</Text>
              </View>
            ))}
          </View>

          {/* ── Specifications (compact table) ─────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Specifications</Text>
            {[
              ['Brand', product.brand?.name],
              ['Category', product.category?.name],
              ['SKU', product.sku],
              ['Weight', product.weight ? `${product.weight} kg` : null],
              ['Min Order', `${product.min_order_quantity} unit(s)`],
              ['Stock', `${product.stock_quantity} units`],
              ['Listed', new Date(product.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
            ].filter(([, v]) => v).map(([k, v], idx, arr) => (
              <View key={idx} style={[styles.specRow, idx === arr.length - 1 && styles.specRowLast]}>
                <Text style={styles.specKey}>{k}</Text>
                <Text style={styles.specVal}>{v}</Text>
              </View>
            ))}
          </View>

          {/* ── Shipping (compact) ─────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Shipping & Returns</Text>
            <View style={styles.shipRow}>
              <MaterialCommunityIcons name="truck-fast" size={18} color={Brand.success} />
              <Text style={styles.shipText}>Fast delivery in 2-5 business days</Text>
            </View>
            <View style={styles.shipRow}>
              <MaterialCommunityIcons name="currency-usd" size={18} color={Brand.success} />
              <Text style={styles.shipText}>Free shipping over 100,000 UGX</Text>
            </View>
            <View style={styles.shipRow}>
              <MaterialCommunityIcons name="undo-variant" size={18} color={Brand.primary} />
              <Text style={styles.shipText}>7-day return policy</Text>
            </View>
            <View style={styles.shipRow}>
              <MaterialCommunityIcons name="shield-check" size={18} color={Brand.link} />
              <Text style={styles.shipText}>Buyer protection guaranteed</Text>
            </View>
            <View style={styles.shipRow}>
              <MaterialCommunityIcons name="credit-card" size={18} color={Brand.textSecondary} />
              <Text style={styles.shipText}>MoMo, Card, PayPal, Cash on Delivery</Text>
            </View>
          </View>

          {/* ── Reviews (compact) ──────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.reviewHeader}>
              <Text style={styles.cardTitle}>Reviews ({reviewCount})</Text>
              <View style={styles.ratingSummary}>
                <Text style={styles.ratingBig}>{rating.toFixed(1)}</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <MaterialCommunityIcons
                      key={i}
                      name={i <= Math.round(rating) ? 'star' : 'star-outline'}
                      size={12}
                      color={Brand.rating}
                    />
                  ))}
                </View>
              </View>
            </View>
            {reviews.length > 0 ? (
              reviews.slice(0, 3).map((review) => (
                <View key={review.id} style={styles.reviewItem}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>{(review.user_name || 'U')[0].toUpperCase()}</Text>
                  </View>
                  <View style={styles.reviewBody}>
                    <View style={styles.reviewHead}>
                      <Text style={styles.reviewName}>{review.user_name || 'Anonymous'}</Text>
                      {review.is_verified_purchase && (
                        <View style={styles.verifiedTag}>
                          <MaterialCommunityIcons name="check-circle" size={10} color={Brand.success} />
                          <Text style={styles.verifiedText}>Verified</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <MaterialCommunityIcons
                          key={i}
                          name={i <= review.rating ? 'star' : 'star-outline'}
                          size={10}
                          color={Brand.rating}
                        />
                      ))}
                    </View>
                    <Text style={styles.reviewComment} numberOfLines={2}>{review.comment}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noReviewsText}>No reviews yet</Text>
            )}
          </View>

          {/* ── Seller (compact) ───────────────────────────────────── */}
          {product.store && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Seller</Text>
              <View style={styles.sellerRow}>
                <View style={styles.sellerLogo}>
                  <MaterialCommunityIcons name="store" size={22} color="#FFFFFF" />
                </View>
                <View style={styles.sellerInfo}>
                  <Text style={styles.sellerName}>{product.store.name}</Text>
                  <Text style={styles.sellerLoc}>{product.store.city}, {product.store.country}</Text>
                </View>
                {product.store.is_wholesaler && (
                  <View style={styles.wholeTag}><Text style={styles.wholeText}>Wholesale</Text></View>
                )}
              </View>
            </View>
          )}

          {/* Spacer for action bar */}
          <View style={{ height: 72 }} />
        </ScrollView>

        {/* ── Fixed action bar (compact) ──────────────────────────── */}
        <View style={styles.actionBar}>
          <Pressable
            style={({ pressed }) => [styles.cartBtn, pressed && { opacity: 0.85 }]}
          >
            <MaterialCommunityIcons name="cart-plus" size={20} color={Brand.primary} />
            <Text style={styles.cartBtnText}>Add to Cart</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.buyBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.buyBtnText}>Buy Now</Text>
          </Pressable>
        </View>
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

  // ── Scroll ──────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 4 },

  // ── Gallery ─────────────────────────────────────────────────────
  gallerySection: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 8,
  },
  mainImageWrap: {
    width: '100%',
    height: 300,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  mainImage: { width: '100%', height: '100%' },
  noImage: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.surfaceAlt },
  badgeStack: { position: 'absolute', top: 12, left: 12, gap: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeSale: { backgroundColor: Brand.danger },
  badgeNew: { backgroundColor: '#0FA958' },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  thumbs: { paddingHorizontal: 16, gap: 8, paddingTop: 8 },
  thumb: {
    width: 48, height: 48, borderRadius: 6, borderWidth: 1.5,
    borderColor: Brand.border, overflow: 'hidden',
  },
  thumbActive: { borderColor: Brand.primary },
  thumbImg: { width: '100%', height: '100%' },

  // ── Title section ───────────────────────────────────────────────
  titleSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.surfaceAlt,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  priceBlock: { gap: 2 },
  oldPrice: { fontSize: 13, color: Brand.textTertiary, textDecorationLine: 'line-through' },
  priceMainRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  priceCurrency: { fontSize: 15, fontWeight: '700', color: Brand.text },
  priceAmount: { fontSize: 26, fontWeight: '800', color: Brand.text },
  discountTag: {
    backgroundColor: Brand.danger, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, marginLeft: 4,
  },
  discountTagText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  saveLine: { fontSize: 12, color: Brand.danger, fontWeight: '600' },

  productName: { fontSize: 16, fontWeight: '600', color: Brand.text, lineHeight: 22 },

  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  starsRow: { flexDirection: 'row', gap: 1 },
  ratingText: { fontSize: 13, fontWeight: '700', color: Brand.text },
  reviewText: { fontSize: 12, color: Brand.textSecondary },
  dividerDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Brand.textTertiary },
  stockText: { fontSize: 12, fontWeight: '600' },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: Brand.surfaceAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  tagText: { fontSize: 11, color: Brand.textSecondary, fontWeight: '500' },
  tagChoice: { backgroundColor: 'rgba(6,125,98,0.1)' },
  tagChoiceText: { fontSize: 11, color: Brand.success, fontWeight: '600' },

  // ── Action chips (wishlist + chat) ──────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.surfaceAlt,
  },
  actionChip: {
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
  actionChipText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },

  // ── Qty + delivery card ─────────────────────────────────────────
  qtyDeliveryCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.surfaceAlt,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyLabel: { fontSize: 14, fontWeight: '600', color: Brand.text },
  qtyControls: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: Brand.border, borderRadius: 6, paddingHorizontal: 4,
  },
  qtyBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  qtyValue: { fontSize: 16, fontWeight: '700', color: Brand.text, minWidth: 20, textAlign: 'center' },
  deliveryMiniRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deliveryMiniText: { fontSize: 13, color: Brand.textSecondary },

  // ── Cards ───────────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    marginTop: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.surfaceAlt,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Brand.text },

  // ── Wholesale tiers ─────────────────────────────────────────────
  tierRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.surfaceAlt,
  },
  tierQty: { fontSize: 13, color: Brand.textSecondary },
  tierPrice: { fontSize: 13, fontWeight: '700', color: Brand.primary },
  moqHint: { fontSize: 12, color: Brand.textTertiary, marginTop: 4 },

  // ── Description ─────────────────────────────────────────────────
  descText: { fontSize: 13, lineHeight: 20, color: Brand.textSecondary },

  // ── Features ────────────────────────────────────────────────────
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  featureText: { fontSize: 13, color: Brand.textSecondary, flex: 1, lineHeight: 18 },

  // ── Specs ───────────────────────────────────────────────────────
  specRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.surfaceAlt,
  },
  specRowLast: { borderBottomWidth: 0 },
  specKey: { fontSize: 13, color: Brand.textSecondary },
  specVal: { fontSize: 13, color: Brand.text, fontWeight: '500' },

  // ── Shipping ────────────────────────────────────────────────────
  shipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shipText: { fontSize: 13, color: Brand.textSecondary },

  // ── Reviews ─────────────────────────────────────────────────────
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ratingSummary: { alignItems: 'flex-end', gap: 2 },
  ratingBig: { fontSize: 18, fontWeight: '800', color: Brand.text },
  reviewItem: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  reviewAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Brand.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  reviewAvatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  reviewBody: { flex: 1, gap: 2 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewName: { fontSize: 13, fontWeight: '600', color: Brand.text },
  verifiedTag: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  verifiedText: { fontSize: 10, color: Brand.success, fontWeight: '600' },
  reviewComment: { fontSize: 12, color: Brand.textSecondary, lineHeight: 16 },
  noReviewsText: { fontSize: 13, color: Brand.textTertiary, paddingVertical: 4 },

  // ── Seller ──────────────────────────────────────────────────────
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sellerLogo: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: Brand.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  sellerInfo: { flex: 1, gap: 1 },
  sellerName: { fontSize: 14, fontWeight: '600', color: Brand.text },
  sellerLoc: { fontSize: 12, color: Brand.textSecondary },
  wholeTag: { backgroundColor: Brand.surfaceAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  wholeText: { fontSize: 10, fontWeight: '600', color: Brand.primary },

  // ── Action bar ──────────────────────────────────────────────────
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.border,
  },
  cartBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Brand.surfaceAlt,
    borderRadius: 8,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: Brand.primary,
  },
  cartBtnText: { fontSize: 14, fontWeight: '700', color: Brand.primary },
  buyBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primary,
    borderRadius: 8,
    paddingVertical: 12,
  },
  buyBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // ── States ──────────────────────────────────────────────────────
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  centerText: { marginTop: 8, color: Brand.textSecondary, fontSize: 14 },
  errorTitle: { marginTop: 8, marginBottom: 12, fontSize: 16, fontWeight: '700', color: Brand.danger, textAlign: 'center' },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
