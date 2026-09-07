import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { addToCart } from '@/services/cart';
import { createReview, fetchProductReviews, trackProductView } from '@/services/catalog';
import { createChatThread } from '@/services/chat';
import { fetchProductBySlug, fetchProducts } from '@/services/products';
import { fetchSponsoredProducts, trackClick as trackPromoClick } from '@/services/promotions';
import { addToWishlist, checkWishlist, removeFromWishlist } from '@/services/wishlist';
import type { Product, Review } from '@/types';

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [sponsoredProducts, setSponsoredProducts] = useState<Product[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const { cartCount, refreshCartCount, incrementCartCount } = useCart();
  const [showFullscreenGallery, setShowFullscreenGallery] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const toastAnim = useRef(new Animated.Value(-100)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (data.id) trackPromoClick(data.id).catch(() => { });
      if (isAuthenticated && data.id) {
        checkWishlist(data.id).then((r: any) => setIsWishlisted(!!r.is_wishlisted)).catch(() => { });
      }
      // Cart count is managed globally via CartContext
      refreshCartCount();

      // ── Fetch related products (same category, exclude current) ──
      if (data.category?.slug) {
        fetchProducts({ category: data.category.slug, page: 1 })
          .then((res) => {
            const filtered = (res.results || []).filter((p) => p.slug !== data.slug);
            setRelatedProducts(filtered.slice(0, 10));
          })
          .catch(() => { });
      }

      // ── Fetch sponsored products (paid promotions) ───────────────
      fetchSponsoredProducts({ category: data.category?.slug, limit: 6 })
        .then((res) => {
          const filtered = (res.results || []).filter((p) => p.slug !== data.slug);
          setSponsoredProducts(filtered.slice(0, 6));
        })
        .catch(() => { });

      // ── Fetch recommended products (featured + top rated, exclude current) ──
      fetchProducts({ featured: 'true', page: 1 })
        .then((res) => {
          const filtered = (res.results || []).filter(
            (p) => p.slug !== data.slug && !p.is_sponsored,
          );
          // If not enough featured, also pull by brand
          if (filtered.length < 6 && data.brand?.slug) {
            fetchProducts({ brand: data.brand.slug, page: 1 })
              .then((res2) => {
                const brandFiltered = (res2.results || []).filter(
                  (p) => p.slug !== data.slug && !filtered.some((f) => f.id === p.id),
                );
                setRecommendedProducts([...filtered, ...brandFiltered].slice(0, 10));
              })
              .catch(() => { });
          } else {
            setRecommendedProducts(filtered.slice(0, 10));
          }
        })
        .catch(() => { });

      // ── Load recently viewed from AsyncStorage ────────────────────
      try {
        const raw = await AsyncStorage.getItem('recently_viewed');
        const list: any[] = raw ? JSON.parse(raw) : [];
        // Filter out the current product and fetch full product data
        const others = list.filter((p: any) => p.slug !== data.slug).slice(0, 10);
        if (others.length > 0) {
          // Fetch full product data for each recently viewed item
          const fetched = await Promise.all(
            others.map((p) =>
              fetchProductBySlug(p.slug).catch(() => null)
            )
          );
          setRecentlyViewed(fetched.filter((p): p is Product => p !== null).slice(0, 10));
        } else {
          setRecentlyViewed([]);
        }
      } catch { }
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

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, text });
    Animated.timing(toastAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: -120,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, 2500);
  }, [toastAnim]);

  const handleAddToCart = useCallback(async () => {
    if (!product) return;
    setAddingToCart(true);
    try {
      await addToCart(product.id, quantity);
      incrementCartCount(quantity);
      showToast('success', `${quantity} ${quantity === 1 ? 'item' : 'items'} added to cart`);
    } catch (e: any) {
      const status = e?.response?.status;
      let msg = 'Failed to add to cart. Please try again.';
      if (status === 400) {
        msg = e?.response?.data?.detail || 'Could not add this item to cart.';
      } else if (status === 404) {
        msg = 'Product not available.';
      }
      showToast('error', msg);
    } finally {
      setAddingToCart(false);
    }
  }, [product, quantity, incrementCartCount, showToast]);

  const handleBuyNow = useCallback(async () => {
    if (!product) return;
    setBuyingNow(true);
    try {
      await addToCart(product.id, quantity);
      incrementCartCount(quantity);
      // Navigate directly to checkout
      router.push('/checkout');
    } catch (e: any) {
      const status = e?.response?.status;
      let msg = 'Failed to place order. Please try again.';
      if (status === 400) {
        msg = e?.response?.data?.detail || 'Could not process this item.';
      } else if (status === 404) {
        msg = 'Product not available.';
      }
      showToast('error', msg);
    } finally {
      setBuyingNow(false);
    }
  }, [product, quantity, incrementCartCount, showToast, router]);

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

  const handleCallNow = useCallback(() => {
    setShowCallModal(true);
  }, []);

  const handleConfirmCall = useCallback(async () => {
    const phone = product?.store?.phone;
    if (!phone) return;
    const cleaned = phone.replace(/\s+/g, '');
    const url = `tel:${cleaned}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch { }
    setShowCallModal(false);
  }, [product]);

  const handleSubmitReview = useCallback(async () => {
    if (!product) return;
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to write a review.');
      router.push('/(auth)/login' as any);
      return;
    }
    if (reviewRating === 0) {
      setReviewError('Please select a star rating.');
      return;
    }
    if (reviewComment.trim().length < 3) {
      setReviewError('Please write a short comment.');
      return;
    }
    setSubmittingReview(true);
    setReviewError(null);
    try {
      const newReview = await createReview(product.slug, reviewRating, reviewComment.trim());
      setReviews((prev) => [newReview, ...prev]);
      setReviewRating(0);
      setReviewComment('');
      setShowReviewForm(false);
      Alert.alert('Review Submitted', 'Thank you for your review!');
    } catch (e: any) {
      setReviewError(e?.message || 'Failed to submit review. You may need to purchase this product first.');
    } finally {
      setSubmittingReview(false);
    }
  }, [product, isAuthenticated, reviewRating, reviewComment, router]);

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
            <Text style={styles.topBarTitle}>Loading…</Text>
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
            <Text style={styles.topBarTitle}>Not Found</Text>
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
        {/* ── Header (gradient with store + product info) ─────────── */}
        <LinearGradient
          colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {/* Row 1: back, store name, actions */}
          <View style={styles.headerTopRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
              <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
            </Pressable>
            {product.store ? (
              <Pressable
                style={styles.headerStore}
                onPress={() => product.store?.slug && router.push(`/store/${product.store.slug}` as any)}
              >
                <MaterialCommunityIcons name="storefront-outline" size={12} color="rgba(255,255,255,0.85)" />
                <Text style={styles.headerStoreName} numberOfLines={1}>{product.store.name}</Text>
                {product.store.is_wholesaler && (
                  <View style={styles.headerWholesaleTag}><Text style={styles.headerWholesaleText}>W</Text></View>
                )}
              </Pressable>
            ) : (
              <View style={styles.headerStore}>
                <MaterialCommunityIcons name="shopping-outline" size={12} color="rgba(255,255,255,0.85)" />
                <Text style={styles.headerStoreName} numberOfLines={1}>Diilzo Marketplace</Text>
              </View>
            )}
            <View style={styles.headerActions}>
              <Pressable hitSlop={8} onPress={handleWishlist} style={styles.headerBtn}>
                <MaterialCommunityIcons name={isWishlisted ? 'heart' : 'heart-outline'} size={20} color={isWishlisted ? '#FF4757' : '#FFFFFF'} />
              </Pressable>
              <Pressable hitSlop={8} onPress={handleShare} style={styles.headerBtn}>
                <MaterialCommunityIcons name="share-variant-outline" size={19} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* Row 2: product name + price */}
          <View style={styles.headerInfoRow}>
            <Text style={styles.headerProductName} numberOfLines={2}>{product.name}</Text>
            <View style={styles.headerPriceCol}>
              <Text style={styles.headerPriceCurrency}>{product.currency}</Text>
              <Text style={styles.headerPriceAmount} numberOfLines={1}>
                {Number(product.final_price).toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Row 3: rating + stock chips */}
          <View style={styles.headerChipsRow}>
            {rating > 0 && (
              <View style={styles.headerChip}>
                <MaterialCommunityIcons name="star" size={10} color="#FFD600" />
                <Text style={styles.headerChipText}>{rating.toFixed(1)}</Text>
                {reviewCount > 0 && <Text style={styles.headerChipSubtext}> ({reviewCount})</Text>}
              </View>
            )}
            <View style={[styles.headerChip, product.is_in_stock ? styles.headerChipGreen : styles.headerChipRed]}>
              <MaterialCommunityIcons
                name={product.is_in_stock ? 'check-circle' : 'close-circle'}
                size={10}
                color="#FFFFFF"
              />
              <Text style={styles.headerChipTextWhite}>{product.is_in_stock ? 'In Stock' : 'Out of Stock'}</Text>
            </View>
            {product.is_on_sale && (
              <View style={styles.headerChipRed}>
                <MaterialCommunityIcons name="tag" size={10} color="#FFFFFF" />
                <Text style={styles.headerChipTextWhite}>SALE -{Math.round(product.discount_percentage)}%</Text>
              </View>
            )}
            {product.is_featured && (
              <View style={styles.headerChipGold}>
                <MaterialCommunityIcons name="crown" size={10} color="#FFFFFF" />
                <Text style={styles.headerChipTextWhite}>Featured</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Image gallery (swipeable carousel) ─────────────────── */}
          <View style={styles.gallerySection}>
            <View style={styles.mainImageWrap}>
              {images.length > 0 ? (
                <FlatList
                  data={images}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(_, idx) => `img-${idx}`}
                  onScroll={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
                    if (idx !== activeImage) setActiveImage(idx);
                  }}
                  scrollEventThrottle={16}
                  renderItem={({ item, index }) => (
                    <Pressable
                      onPress={() => { setFullscreenIndex(index); setShowFullscreenGallery(true); }}
                      style={{ width: screenWidth, height: screenWidth }}
                    >
                      <Image
                        source={{ uri: item }}
                        style={styles.mainImage}
                        contentFit="contain"
                        transition={150}
                      />
                    </Pressable>
                  )}
                  style={styles.carousel}
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
              {/* Image counter */}
              {images.length > 1 && (
                <View style={styles.imgCounter}>
                  <Text style={styles.imgCounterText}>{activeImage + 1} / {images.length}</Text>
                </View>
              )}
              {/* Expand icon */}
              {images.length > 0 && (
                <Pressable
                  style={styles.expandBtn}
                  onPress={() => { setFullscreenIndex(activeImage); setShowFullscreenGallery(true); }}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="arrow-expand-all" size={18} color="#FFFFFF" />
                </Pressable>
              )}
            </View>

            {/* Dot indicators */}
            {images.length > 1 && (
              <View style={styles.dotsRow}>
                {images.map((_, idx) => (
                  <View
                    key={idx}
                    style={[styles.dot, activeImage === idx && styles.dotActive]}
                  />
                ))}
              </View>
            )}

            {/* Thumbnail strip */}
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

            {/* Write a Review button / form */}
            {!showReviewForm && (
              <Pressable
                style={styles.writeReviewBtn}
                onPress={() => {
                  if (!isAuthenticated) {
                    setShowAuthPrompt(true);
                    return;
                  }
                  setShowReviewForm(true);
                }}
              >
                <MaterialCommunityIcons name="star-plus-outline" size={20} color={Brand.primary} />
                <Text style={styles.writeReviewText}>Write a Review</Text>
              </Pressable>
            )}

            {showReviewForm && (
              <View style={styles.reviewForm}>
                <Text style={styles.reviewFormLabel}>Your Rating</Text>
                <View style={styles.starInputRow}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Pressable key={i} onPress={() => setReviewRating(i)} hitSlop={8}>
                      <MaterialCommunityIcons
                        name={i <= reviewRating ? 'star' : 'star-outline'}
                        size={32}
                        color={i <= reviewRating ? Brand.rating : Brand.border}
                      />
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.reviewFormLabel}>Your Comment</Text>
                <TextInput
                  style={styles.reviewInput}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  placeholder="Share your experience with this product..."
                  placeholderTextColor={Brand.textTertiary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                {reviewError && (
                  <Text style={styles.reviewErrorText}>{reviewError}</Text>
                )}
                <View style={styles.reviewFormActions}>
                  <Pressable
                    style={styles.reviewCancelBtn}
                    onPress={() => {
                      setShowReviewForm(false);
                      setReviewRating(0);
                      setReviewComment('');
                      setReviewError(null);
                    }}
                  >
                    <Text style={styles.reviewCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.reviewSubmitBtn, submittingReview && { opacity: 0.6 }]}
                    onPress={handleSubmitReview}
                    disabled={submittingReview}
                  >
                    {submittingReview ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.reviewSubmitText}>Submit Review</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

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
              !showReviewForm && <Text style={styles.noReviewsText}>No reviews yet</Text>
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
                  <View style={styles.sellerNameRow}>
                    <Text style={styles.sellerName}>{product.store.name}</Text>
                    {product.store.verification_status === 'verified' && (
                      <MaterialCommunityIcons name="check-decagram" size={14} color={Brand.primary} />
                    )}
                  </View>
                  <Text style={styles.sellerLoc}>{product.store.city}, {product.store.country}</Text>
                </View>
                {product.store.is_wholesaler && (
                  <View style={styles.wholeTag}><Text style={styles.wholeText}>Wholesale</Text></View>
                )}
              </View>
              {product.store.is_wholesaler && (
                <Pressable
                  style={({ pressed }) => [styles.rfqBtn, pressed && styles.rfqBtnPressed]}
                  onPress={() => router.push({
                    pathname: '/suppliers',
                    params: {
                      rfq: '1',
                      product_name: product.name,
                      store: product.store?.slug || '',
                    },
                  } as any)}
                >
                  <MaterialCommunityIcons name="file-document-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.rfqBtnText}>Request for Quotation</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* ── Sponsored Products (paid promotions) ─────────────────── */}
          {sponsoredProducts.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sponsoredHeaderLeft}>
                  <MaterialCommunityIcons name="star-circle" size={18} color={Brand.accent} />
                  <Text style={styles.sectionTitle}>Sponsored</Text>
                </View>
                <Text style={styles.sponsoredLabel}>Ad</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {sponsoredProducts.map((item) => (
                  <Pressable
                    key={`sp-${item.id}`}
                    style={styles.hCard}
                    onPress={() => {
                      if (item.id) trackPromoClick(item.id).catch(() => { });
                      router.push(`/product/${item.slug}`);
                    }}
                  >
                    <View style={styles.hImgWrap}>
                      {item.primary_image_url ? (
                        <Image source={{ uri: item.primary_image_url }} style={styles.hImg} contentFit="cover" />
                      ) : (
                        <View style={[styles.hImg, { backgroundColor: Brand.surfaceAlt }]}>
                          <MaterialCommunityIcons name="image-off" size={24} color={Brand.textTertiary} />
                        </View>
                      )}
                      <View style={styles.sponsoredBadge}><Text style={styles.sponsoredBadgeText}>SPONSORED</Text></View>
                      {item.is_on_sale && (
                        <View style={[styles.hBadge, styles.hBadgeSalePos]}><Text style={styles.hBadgeText}>SALE</Text></View>
                      )}
                    </View>
                    <Text style={styles.hName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.hPrice}>{item.currency} {Number(item.final_price).toLocaleString()}</Text>
                    {item.is_in_stock ? (
                      <View style={styles.hStockRow}>
                        <MaterialCommunityIcons name="check-circle" size={10} color={Brand.success} />
                        <Text style={styles.hStockText}>In Stock</Text>
                      </View>
                    ) : (
                      <Text style={[styles.hStockText, { color: Brand.danger }]}>Out of Stock</Text>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Recommended Products (featured + top rated) ──────────── */}
          {recommendedProducts.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sponsoredHeaderLeft}>
                  <MaterialCommunityIcons name="lightning-bolt" size={18} color={Brand.primary} />
                  <Text style={styles.sectionTitle}>Recommended for You</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {recommendedProducts.map((item) => (
                  <Pressable
                    key={`rec-${item.id}`}
                    style={styles.hCard}
                    onPress={() => router.push(`/product/${item.slug}`)}
                  >
                    <View style={styles.hImgWrap}>
                      {item.primary_image_url ? (
                        <Image source={{ uri: item.primary_image_url }} style={styles.hImg} contentFit="cover" />
                      ) : (
                        <View style={[styles.hImg, { backgroundColor: Brand.surfaceAlt }]}>
                          <MaterialCommunityIcons name="image-off" size={24} color={Brand.textTertiary} />
                        </View>
                      )}
                      {item.is_featured && (
                        <View style={styles.featuredBadge}><Text style={styles.featuredBadgeText}>FEATURED</Text></View>
                      )}
                      {item.is_on_sale && (
                        <View style={[styles.hBadge, styles.hBadgeSalePos]}><Text style={styles.hBadgeText}>SALE</Text></View>
                      )}
                    </View>
                    <Text style={styles.hName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.hPrice}>{item.currency} {Number(item.final_price).toLocaleString()}</Text>
                    {item.is_in_stock ? (
                      <View style={styles.hStockRow}>
                        <MaterialCommunityIcons name="check-circle" size={10} color={Brand.success} />
                        <Text style={styles.hStockText}>In Stock</Text>
                      </View>
                    ) : (
                      <Text style={[styles.hStockText, { color: Brand.danger }]}>Out of Stock</Text>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Related Products (same category) ────────────────────── */}
          {relatedProducts.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Related Products</Text>
                {product.category && (
                  <Pressable
                    onPress={() => router.push({
                      pathname: '/search',
                      params: { category: product.category!.slug, categoryName: product.category!.name },
                    } as any)}
                  >
                    <Text style={styles.seeAllText}>See All</Text>
                  </Pressable>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {relatedProducts.map((item) => (
                  <Pressable
                    key={`rel-${item.id}`}
                    style={styles.hCard}
                    onPress={() => router.push(`/product/${item.slug}`)}
                  >
                    <View style={styles.hImgWrap}>
                      {item.primary_image_url ? (
                        <Image source={{ uri: item.primary_image_url }} style={styles.hImg} contentFit="cover" />
                      ) : (
                        <View style={[styles.hImg, { backgroundColor: Brand.surfaceAlt }]}>
                          <MaterialCommunityIcons name="image-off" size={24} color={Brand.textTertiary} />
                        </View>
                      )}
                      {item.is_on_sale && (
                        <View style={styles.hBadge}><Text style={styles.hBadgeText}>SALE</Text></View>
                      )}
                    </View>
                    <Text style={styles.hName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.hPrice}>{item.currency} {Number(item.final_price).toLocaleString()}</Text>
                    {item.is_in_stock ? (
                      <View style={styles.hStockRow}>
                        <MaterialCommunityIcons name="check-circle" size={10} color={Brand.success} />
                        <Text style={styles.hStockText}>In Stock</Text>
                      </View>
                    ) : (
                      <Text style={[styles.hStockText, { color: Brand.danger }]}>Out of Stock</Text>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Customers Also Viewed (recently viewed) ─────────────── */}
          {recentlyViewed.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Customers Also Viewed</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {recentlyViewed.map((item) => (
                  <Pressable
                    key={`rv-${item.id}`}
                    style={styles.hCard}
                    onPress={() => router.push(`/product/${item.slug}`)}
                  >
                    <View style={styles.hImgWrap}>
                      {item.primary_image_url ? (
                        <Image source={{ uri: item.primary_image_url }} style={styles.hImg} contentFit="cover" />
                      ) : (
                        <View style={[styles.hImg, { backgroundColor: Brand.surfaceAlt }]}>
                          <MaterialCommunityIcons name="image-off" size={24} color={Brand.textTertiary} />
                        </View>
                      )}
                    </View>
                    <Text style={styles.hName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.hPrice}>{item.currency} {Number(item.final_price).toLocaleString()}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Spacer for action bar */}
          <View style={{ height: 72 }} />
        </ScrollView>

        {/* ── Fixed action bar (compact) ──────────────────────────── */}
        <View style={styles.actionBar}>
          <Pressable
            style={({ pressed }) => [styles.cartBtn, pressed && { opacity: 0.85 }]}
            onPress={handleAddToCart}
            disabled={addingToCart || buyingNow}
          >
            {addingToCart ? (
              <ActivityIndicator size="small" color={Brand.primary} />
            ) : (
              <MaterialCommunityIcons name="cart-plus" size={20} color={Brand.primary} />
            )}
            <Text style={styles.cartBtnText}>Add to Cart</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.callBtn, pressed && { opacity: 0.85 }]}
            onPress={handleCallNow}
          >
            <MaterialCommunityIcons name="phone" size={18} color="#FFFFFF" />
            <Text style={styles.callBtnText}>Call Now</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.buyBtn, pressed && { opacity: 0.85 }, (buyingNow || addingToCart) && { opacity: 0.6 }]}
            onPress={handleBuyNow}
            disabled={buyingNow || addingToCart}
          >
            {buyingNow ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.buyBtnText}>Buy Now</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>

      {/* ── Toast notification ──────────────────────────────────────── */}
      {toast && (
        <Animated.View
          style={[
            styles.toast,
            toast.type === 'error' && styles.toastError,
            { transform: [{ translateY: toastAnim }] },
          ]}
        >
          <MaterialCommunityIcons
            name={toast.type === 'success' ? 'check-circle' : 'alert-circle'}
            size={22}
            color="#FFFFFF"
          />
          <Text style={styles.toastText}>{toast.text}</Text>
        </Animated.View>
      )}

      {/* ── Fullscreen image gallery ──────────────────────────────── */}
      <Modal visible={showFullscreenGallery} transparent animationType="fade">
        <View style={styles.fsOverlay}>
          {/* Header */}
          <View style={styles.fsHeader}>
            <Pressable
              onPress={() => setShowFullscreenGallery(false)}
              hitSlop={12}
              style={styles.fsCloseBtn}
            >
              <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.fsCounter}>
              {fullscreenIndex + 1} / {images.length}
            </Text>
            <View style={{ width: 26 }} />
          </View>

          {/* Swipeable fullscreen images */}
          {images.length > 0 && (
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, idx) => `fs-img-${idx}`}
              onScroll={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
                if (idx !== fullscreenIndex) setFullscreenIndex(idx);
              }}
              scrollEventThrottle={16}
              getItemLayout={(_, index) => ({
                length: screenWidth,
                offset: screenWidth * index,
                index,
              })}
              renderItem={({ item }) => (
                <View style={{ width: screenWidth, height: screenWidth }}>
                  <Image
                    source={{ uri: item }}
                    style={styles.fsImage}
                    contentFit="contain"
                  />
                </View>
              )}
            />
          )}

          {/* Thumbnail strip at bottom */}
          {images.length > 1 && (
            <View style={styles.fsThumbsWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fsThumbs}>
                {images.map((img, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => setFullscreenIndex(idx)}
                    style={[styles.fsThumb, fullscreenIndex === idx && styles.fsThumbActive]}
                  >
                    <Image source={{ uri: img }} style={styles.fsThumbImg} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      {/* ── Themed auth prompt modal ──────────────────────────────── */}
      <Modal visible={showAuthPrompt} transparent animationType="fade">
        <View style={styles.authOverlay}>
          <View style={styles.authCard}>
            {/* Gradient header */}
            <LinearGradient
              colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.authHeader}
            >
              <View style={styles.authIconWrap}>
                <MaterialCommunityIcons name="account-lock-outline" size={32} color="#FFFFFF" />
              </View>
            </LinearGradient>

            {/* Body */}
            <View style={styles.authBody}>
              <Text style={styles.authTitle}>Sign In Required</Text>
              <Text style={styles.authMessage}>
                Please sign in to write a review and share your experience with other buyers.
              </Text>

              {/* Buttons */}
              <View style={styles.authBtnRow}>
                <Pressable
                  style={styles.authCancelBtn}
                  onPress={() => setShowAuthPrompt(false)}
                >
                  <Text style={styles.authCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.authSignInBtn}
                  onPress={() => {
                    setShowAuthPrompt(false);
                    router.push('/(auth)/login' as any);
                  }}
                >
                  <MaterialCommunityIcons name="login" size={18} color="#FFFFFF" />
                  <Text style={styles.authSignInText}>Sign In</Text>
                </Pressable>
              </View>

              {/* Register link */}
              <Pressable
                onPress={() => {
                  setShowAuthPrompt(false);
                  router.push('/(auth)/register' as any);
                }}
                hitSlop={8}
              >
                <Text style={styles.authRegisterText}>
                  Don't have an account? <Text style={styles.authRegisterLink}>Create one free</Text>
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Call Now themed modal ─────────────────────────────────── */}
      <Modal visible={showCallModal} transparent animationType="fade">
        <Pressable style={styles.callOverlay} onPress={() => setShowCallModal(false)}>
          <Pressable style={styles.callCard} onPress={(e) => e.stopPropagation()}>
            {/* Gradient header with avatar */}
            <LinearGradient
              colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.callHeader}
            >
              <Pressable
                style={styles.callCloseBtn}
                onPress={() => setShowCallModal(false)}
                hitSlop={8}
              >
                <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
              </Pressable>
              <View style={styles.callAvatarWrap}>
                <View style={styles.callAvatar}>
                  <MaterialCommunityIcons name="phone" size={28} color="#FFFFFF" />
                </View>
                {/* Pulsing ring effect */}
                <View style={styles.callAvatarRing} />
              </View>
            </LinearGradient>

            {/* Body */}
            <View style={styles.callBody}>
              <Text style={styles.callTitle}>Call the Seller</Text>
              {product?.store ? (
                <Text style={styles.callStoreName}>{product.store.name}</Text>
              ) : (
                <Text style={styles.callStoreName}>Diilzo Marketplace</Text>
              )}

              {product?.store?.phone ? (
                <>
                  <View style={styles.callPhoneBox}>
                    <MaterialCommunityIcons name="phone-outline" size={18} color={Brand.primary} />
                    <Text style={styles.callPhoneText}>{product.store.phone}</Text>
                  </View>
                  <Text style={styles.callHint}>
                    You're about to call this seller directly. Standard call rates may apply.
                  </Text>

                  {/* Action buttons */}
                  <View style={styles.callBtnRow}>
                    <Pressable
                      style={styles.callCancelBtn}
                      onPress={() => setShowCallModal(false)}
                    >
                      <Text style={styles.callCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={styles.callConfirmBtn}
                      onPress={handleConfirmCall}
                    >
                      <MaterialCommunityIcons name="phone-in-talk" size={18} color="#FFFFFF" />
                      <Text style={styles.callConfirmText}>Call Now</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.callNoPhoneBox}>
                    <MaterialCommunityIcons name="phone-off" size={28} color={Brand.textTertiary} />
                    <Text style={styles.callNoPhoneText}>
                      This seller hasn't provided a phone number.
                    </Text>
                  </View>
                  <Pressable
                    style={styles.callOkBtn}
                    onPress={() => setShowCallModal(false)}
                  >
                    <Text style={styles.callOkText}>OK</Text>
                  </Pressable>
                </>
              )}

              {/* Chat alternative */}
              {product?.store?.slug && (
                <Pressable
                  style={styles.callChatAlt}
                  onPress={() => {
                    setShowCallModal(false);
                    handleChat();
                  }}
                >
                  <MaterialCommunityIcons name="chat-outline" size={16} color={Brand.primary} />
                  <Text style={styles.callChatAltText}>Or chat with seller instead</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },

  // ── Header (compact gradient with store + product info) ─────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topBarTitle: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', flex: 1, textAlign: 'center' },

  header: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerBtn: { padding: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerStore: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: 8,
  },
  headerStoreName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  headerWholesaleTag: {
    width: 14, height: 14, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerWholesaleText: { fontSize: 8, fontWeight: '800', color: '#FFFFFF' },

  headerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 5,
  },
  headerProductName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 18,
  },
  headerPriceCol: { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  headerPriceCurrency: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  headerPriceAmount: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

  headerChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  headerChipText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  headerChipSubtext: { fontSize: 9, color: 'rgba(255,255,255,0.7)' },
  headerChipGreen: { backgroundColor: 'rgba(255,255,255,0.25)' },
  headerChipRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(220,38,38,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  headerChipGold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,193,7,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  headerChipTextWhite: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  // ── Scroll ──────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 4 },

  // ── Gallery (swipeable carousel) ────────────────────────────────
  gallerySection: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 8,
  },
  mainImageWrap: {
    width: '100%',
    height: screenWidth,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  carousel: { width: '100%', height: screenWidth },
  mainImage: { width: '100%', height: '100%' },
  noImage: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.surfaceAlt },
  badgeStack: { position: 'absolute', top: 12, left: 12, gap: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeSale: { backgroundColor: Brand.danger },
  badgeNew: { backgroundColor: '#0FA958' },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  imgCounter: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
  },
  imgCounterText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  expandBtn: {
    position: 'absolute', bottom: 10, left: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 5, paddingVertical: 8,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.border,
  },
  dotActive: { width: 18, height: 6, borderRadius: 3, backgroundColor: Brand.primary },
  thumbs: { paddingHorizontal: 16, gap: 8, paddingTop: 4 },
  thumb: {
    width: 52, height: 52, borderRadius: 8, borderWidth: 1.5,
    borderColor: Brand.border, overflow: 'hidden',
  },
  thumbActive: { borderColor: Brand.primary, borderWidth: 2 },
  thumbImg: { width: '100%', height: '100%' },

  // ── Fullscreen gallery ──────────────────────────────────────────
  fsOverlay: { flex: 1, backgroundColor: '#000000' },
  fsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12,
  },
  fsCloseBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  fsCounter: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  fsImage: { width: '100%', height: '100%' },
  fsThumbsWrap: { paddingBottom: 30, paddingTop: 12 },
  fsThumbs: { paddingHorizontal: 12, gap: 6 },
  fsThumb: {
    width: 44, height: 44, borderRadius: 6, borderWidth: 2,
    borderColor: 'transparent', overflow: 'hidden',
  },
  fsThumbActive: { borderColor: '#FFFFFF' },
  fsThumbImg: { width: '100%', height: '100%' },

  // ── Themed auth prompt modal ────────────────────────────────────
  authOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  authCard: {
    width: '100%', maxWidth: 340, backgroundColor: '#FFFFFF',
    borderRadius: 20, overflow: 'hidden',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.2,
    shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
  },
  authHeader: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 24,
  },
  authIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  authBody: { padding: 20, alignItems: 'center' },
  authTitle: { fontSize: 20, fontWeight: '800', color: Brand.text, marginBottom: 8 },
  authMessage: {
    fontSize: 14, color: Brand.textSecondary, textAlign: 'center',
    lineHeight: 20, marginBottom: 20,
  },
  authBtnRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 16 },
  authCancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.surfaceAlt, borderRadius: 10, paddingVertical: 12,
    borderWidth: 1, borderColor: Brand.border,
  },
  authCancelText: { fontSize: 15, fontWeight: '600', color: Brand.textSecondary },
  authSignInBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Brand.primary, borderRadius: 10, paddingVertical: 12,
  },
  authSignInText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  authRegisterText: { fontSize: 13, color: Brand.textTertiary, textAlign: 'center' },
  authRegisterLink: { color: Brand.primary, fontWeight: '700' },

  // ── Call Now modal ──────────────────────────────────────────────
  callOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  callCard: {
    width: '100%', maxWidth: 320, backgroundColor: '#FFFFFF',
    borderRadius: 20, overflow: 'hidden',
    elevation: 10, shadowColor: '#000', shadowOpacity: 0.25,
    shadowRadius: 20, shadowOffset: { width: 0, height: 6 },
  },
  callHeader: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 28, position: 'relative',
  },
  callCloseBtn: {
    position: 'absolute', top: 10, right: 12,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  callAvatarWrap: {
    width: 72, height: 72,
    alignItems: 'center', justifyContent: 'center',
  },
  callAvatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  callAvatarRing: {
    position: 'absolute', width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  callBody: { padding: 20, alignItems: 'center' },
  callTitle: { fontSize: 18, fontWeight: '800', color: Brand.text, marginBottom: 4 },
  callStoreName: { fontSize: 14, color: Brand.textSecondary, marginBottom: 16 },
  callPhoneBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Brand.primary + '12',
    borderWidth: 1, borderColor: Brand.primary + '30',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 12,
  },
  callPhoneText: { fontSize: 18, fontWeight: '700', color: Brand.text, letterSpacing: 0.5 },
  callHint: {
    fontSize: 12, color: Brand.textTertiary, textAlign: 'center',
    lineHeight: 17, marginBottom: 18, paddingHorizontal: 8,
  },
  callBtnRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 14 },
  callCancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.surfaceAlt, borderRadius: 10, paddingVertical: 12,
    borderWidth: 1, borderColor: Brand.border,
  },
  callCancelText: { fontSize: 15, fontWeight: '600', color: Brand.textSecondary },
  callConfirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Brand.primary, borderRadius: 10, paddingVertical: 12,
  },
  callConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  callNoPhoneBox: {
    alignItems: 'center', gap: 10,
    paddingVertical: 16, marginBottom: 16,
  },
  callNoPhoneText: {
    fontSize: 14, color: Brand.textSecondary, textAlign: 'center', lineHeight: 19,
  },
  callOkBtn: {
    width: '100%', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.primary, borderRadius: 10, paddingVertical: 12,
    marginBottom: 14,
  },
  callOkText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  callChatAlt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8,
  },
  callChatAltText: { fontSize: 13, color: Brand.primary, fontWeight: '600' },

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

  // ── Review form ─────────────────────────────────────────────────
  writeReviewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary + '15',
    borderWidth: 1.5, borderColor: Brand.primary, borderRadius: 10,
    paddingVertical: 14, marginVertical: 12,
  },
  writeReviewText: { fontSize: 15, fontWeight: '700', color: Brand.primary },
  reviewForm: { marginVertical: 10, gap: 8 },
  reviewFormLabel: { fontSize: 14, fontWeight: '600', color: Brand.text },
  starInputRow: { flexDirection: 'row', gap: 4, paddingVertical: 4 },
  reviewInput: {
    borderWidth: 1, borderColor: Brand.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Brand.text, minHeight: 80,
    backgroundColor: Brand.surfaceAlt,
  },
  reviewErrorText: { fontSize: 12, color: Brand.danger, fontWeight: '500' },
  reviewFormActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  reviewCancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.surfaceAlt, borderRadius: 8, paddingVertical: 10,
    borderWidth: 1, borderColor: Brand.border,
  },
  reviewCancelText: { fontSize: 14, fontWeight: '600', color: Brand.textSecondary },
  reviewSubmitBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.primary, borderRadius: 8, paddingVertical: 10,
  },
  reviewSubmitText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // ── Seller ──────────────────────────────────────────────────────
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sellerLogo: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: Brand.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  sellerInfo: { flex: 1, gap: 1 },
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sellerName: { fontSize: 14, fontWeight: '600', color: Brand.text },
  sellerLoc: { fontSize: 12, color: Brand.textSecondary },
  wholeTag: { backgroundColor: Brand.surfaceAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  wholeText: { fontSize: 10, fontWeight: '600', color: Brand.primary },
  rfqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Brand.primary,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 10,
  },
  rfqBtnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  rfqBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

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
  cartBtnText: { fontSize: 13, fontWeight: '700', color: Brand.primary },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#0FA958',
    borderRadius: 8,
    paddingVertical: 12,
  },
  callBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  buyBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primary,
    borderRadius: 8,
    paddingVertical: 12,
  },
  buyBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // ── Toast ────────────────────────────────────────────────────────
  toast: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Brand.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 9999,
  },
  toastError: {
    backgroundColor: Brand.danger,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },

  // ── States ──────────────────────────────────────────────────────
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  centerText: { marginTop: 8, color: Brand.textSecondary, fontSize: 14 },
  errorTitle: { marginTop: 8, marginBottom: 12, fontSize: 16, fontWeight: '700', color: Brand.danger, textAlign: 'center' },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // ── Related Products & Customers Also Viewed ────────────────────
  sectionCard: {
    backgroundColor: '#FFFFFF', marginTop: 8, paddingVertical: 14, paddingHorizontal: 4,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.text },
  seeAllText: { fontSize: 13, fontWeight: '600', color: Brand.primary },
  hScroll: { paddingHorizontal: 8, gap: 0 },
  hCard: {
    width: 140, marginHorizontal: 4, backgroundColor: '#FFFFFF',
    borderRadius: 10, padding: 8, borderWidth: 1, borderColor: Brand.borderLight,
  },
  hImgWrap: { position: 'relative', marginBottom: 6 },
  hImg: {
    width: '100%', height: 120, borderRadius: 8, backgroundColor: Brand.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  hBadge: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: Brand.danger, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  hBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  hBadgeSalePos: { top: 4, right: 4, left: 'auto' },
  sponsoredHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sponsoredLabel: {
    fontSize: 10, fontWeight: '700', color: Brand.textTertiary,
    backgroundColor: Brand.surfaceAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  sponsoredBadge: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: Brand.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  sponsoredBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  featuredBadge: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: Brand.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  featuredBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  hName: { fontSize: 12, fontWeight: '600', color: Brand.text, lineHeight: 16, minHeight: 32 },
  hPrice: { fontSize: 13, fontWeight: '700', color: Brand.primary, marginTop: 4 },
  hStockRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  hStockText: { fontSize: 10, color: Brand.success, fontWeight: '500' },
});
