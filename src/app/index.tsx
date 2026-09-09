import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiilzoLogo } from '@/components/diilzo-logo';
import { ScrollToTopButton } from '@/components/scroll-to-top';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useImageDimensions } from '@/hooks/useImageDimensions';
import {
  fetchBecauseYouViewed,
  fetchCategories,
  fetchClaimableCoupons,
  fetchFlashSaleProducts,
  fetchRecentlyViewed,
  fetchSlides,
  fetchTopBrands,
  fetchTopStores,
  fetchUnreadNotificationCount,
} from '@/services/catalog';
import { createChatThread } from '@/services/chat';
import { fetchProducts } from '@/services/products';
import type {
  Brand as BrandType,
  Category,
  ClaimableCoupon,
  Product,
  Slide,
  SlidePosition,
  Store,
} from '@/types';

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
            contentFit="contain"
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
  const { width: windowWidth } = useWindowDimensions();
  // Single source of truth: carousel has Spacing.two (8px) horizontal margin
  // on each side, so the visible ScrollView viewport = windowWidth - 16.
  // Each slide card must match this exactly for pagingEnabled to snap cleanly.
  const slideWidth = windowWidth - Spacing.two * 2;
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
            x: next * slideWidth,
            animated: true,
          });
        }
        return next;
      });
    }, 4000);
    return () => {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    };
  }, [slides.length, slideWidth]);

  if (slides.length === 0) return null;

  return (
    <View style={styles.carouselWrap}>
      <ScrollView
        ref={(ref) => { if (ref) { (slideScrollRef as any).current = ref; } }}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
          if (idx !== activeSlide) setActiveSlide(idx);
        }}
        scrollEventThrottle={16}
      >
        {slides.map((slide) => {
          const isDarkButton = slide.button_style === 'dark';
          const buttonBg = isDarkButton ? '#111111' : '#FFFFFF';
          const buttonColor = isDarkButton ? '#FFFFFF' : Brand.primary;
          return (
            <Pressable
              key={`slide-${slide.id}`}
              style={[styles.slideCard, { width: slideWidth, height: slideWidth / 2 + 52 }, slide.background_color ? { backgroundColor: slide.background_color } : null]}
              onPress={() => {
                // Priority: category > brand > cta_link / link_url
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
                } else {
                  const link = slide.cta_link || slide.link_url;
                  if (link) {
                    if (link.startsWith('/')) {
                      router.push(link as any);
                    } else {
                      Linking.openURL(link).catch(() => { });
                    }
                  }
                }
              }}
            >
              <View style={styles.slideImageWrap}>
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
              </View>
              <View style={styles.slideOverlay}>
                <View style={styles.slideTextCol}>
                  {!!slide.headline && (
                    <Text style={styles.slideHeadline} numberOfLines={1}>{slide.headline}</Text>
                  )}
                  {!!slide.subheadline && (
                    <Text style={styles.slideSubheadline} numberOfLines={2}>{slide.subheadline}</Text>
                  )}
                </View>
                {!!slide.cta_text && (
                  <View style={[styles.slideButton, { backgroundColor: buttonBg }]}>
                    <Text style={[styles.slideButtonText, { color: buttonColor }]} numberOfLines={1}>{slide.cta_text}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
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

// ── Flash Sale countdown hook ──────────────────────────────────────
function useCountdown(endsAt: string | null) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!endsAt) { setRemaining(0); return; }
    const target = new Date(endsAt).getTime();
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setRemaining(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  if (remaining <= 0) return null;
  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h, m, s };
}

// ── Flash Sale shelf with live countdown ───────────────────────────
const FlashSaleShelf = memo(function FlashSaleShelf({
  products,
  endsAt,
  onPress,
}: {
  products: Product[];
  endsAt: string | null;
  onPress: (slug: string) => void;
}) {
  const cd = useCountdown(endsAt);
  if (!products.length) return null;
  return (
    <View style={styles.flashSection}>
      <LinearGradient
        colors={['#F97316', '#EF4444']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.flashHeader}
      >
        <View style={styles.flashTitleRow}>
          <MaterialCommunityIcons name="flash" size={22} color="#FFFFFF" />
          <Text style={styles.flashTitle}>Flash Sale</Text>
        </View>
        {cd && (
          <View style={styles.countdownRow}>
            <Text style={styles.countdownLabel}>Ends in</Text>
            <View style={styles.countdownBox}><Text style={styles.countdownDigit}>{String(cd.h).padStart(2, '0')}</Text></View>
            <Text style={styles.countdownColon}>:</Text>
            <View style={styles.countdownBox}><Text style={styles.countdownDigit}>{String(cd.m).padStart(2, '0')}</Text></View>
            <Text style={styles.countdownColon}>:</Text>
            <View style={styles.countdownBox}><Text style={styles.countdownDigit}>{String(cd.s).padStart(2, '0')}</Text></View>
          </View>
        )}
      </LinearGradient>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselTrack}
        decelerationRate="fast"
        snapToInterval={160}
        snapToAlignment="start"
      >
        {products.map((item) => (
          <Pressable
            key={`flash-${item.id}`}
            style={({ pressed }) => [styles.carouselCard, pressed && styles.cardPressed]}
            onPress={() => onPress(item.slug)}
          >
            <View style={styles.carouselImageWrap}>
              {item.primary_image_url ? (
                <Image source={{ uri: item.primary_image_url }} style={styles.carouselImage} contentFit="contain" transition={200} />
              ) : (
                <View style={styles.noImage}><MaterialCommunityIcons name="image-outline" size={32} color={Brand.textTertiary} /></View>
              )}
              <View style={styles.flashBadge}><Text style={styles.flashBadgeText}>-{item.discount_percentage}%</Text></View>
            </View>
            <Text style={styles.carouselName} numberOfLines={2}>{item.name}</Text>
            <View style={styles.carouselPriceRow}>
              <Text style={styles.currency}>{item.currency}</Text>
              <Text style={styles.carouselPrice}>{Number(item.final_price).toLocaleString()}</Text>
            </View>
            {item.is_on_sale && (
              <Text style={styles.carouselOrigPrice}>{item.currency} {Number(item.price).toLocaleString()}</Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
});

// ── Voucher banner (claimable coupons) ─────────────────────────────
const VoucherBanner = memo(function VoucherBanner({ vouchers }: { vouchers: ClaimableCoupon[] }) {
  if (!vouchers.length) return null;
  return (
    <View style={styles.voucherSection}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name="ticket-percent" size={20} color={Brand.primary} />
          <Text style={styles.sectionTitle}>Grab a Voucher</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.voucherTrack}
      >
        {vouchers.map((v) => (
          <View key={`v-${v.code}`} style={styles.voucherCard}>
            <View style={styles.voucherIconWrap}>
              <MaterialCommunityIcons name="ticket-percent" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.voucherBody}>
              <Text style={styles.voucherCode}>{v.code}</Text>
              <Text style={styles.voucherDesc}>
                {v.discount_type === 'percentage'
                  ? `${v.discount_value}% OFF`
                  : `${v.discount_value} OFF`}
                {v.store_name ? ` • ${v.store_name}` : ''}
              </Text>
              {v.min_order_amount && Number(v.min_order_amount) > 0 && (
                <Text style={styles.voucherMin}>Min order {v.min_order_amount}</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

// ── Dual promo banner tiles (tile_a / tile_b) ──────────────────────
const DualBannerTiles = memo(function DualBannerTiles({
  tileA,
  tileB,
  onPress,
}: {
  tileA: Slide[];
  tileB: Slide[];
  onPress: (slide: Slide) => void;
}) {
  if (!tileA.length && !tileB.length) return null;
  return (
    <View style={styles.dualTilesWrap}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name="tag-multiple" size={20} color={Brand.primary} />
          <Text style={styles.sectionTitle}>Featured Promotions</Text>
        </View>
      </View>
      <View style={styles.dualTilesRow}>
        {tileA[0] && (
          <Pressable style={({ pressed }) => [styles.dualTile, pressed && { opacity: 0.9 }]} onPress={() => onPress(tileA[0])}>
            {tileA[0].display_image ? (
              <Image source={{ uri: tileA[0].display_image }} style={styles.dualTileImage} contentFit="cover" transition={200} />
            ) : (
              <LinearGradient colors={[Brand.primary, Brand.accent]} style={styles.dualTileFallback}>
                <Text style={styles.dualTileText} numberOfLines={2}>{tileA[0].headline || tileA[0].title}</Text>
              </LinearGradient>
            )}
          </Pressable>
        )}
        {tileB[0] && (
          <Pressable style={({ pressed }) => [styles.dualTile, pressed && { opacity: 0.9 }]} onPress={() => onPress(tileB[0])}>
            {tileB[0].display_image ? (
              <Image source={{ uri: tileB[0].display_image }} style={styles.dualTileImage} contentFit="cover" transition={200} />
            ) : (
              <LinearGradient colors={['#F97316', '#EF4444']} style={styles.dualTileFallback}>
                <Text style={styles.dualTileText} numberOfLines={2}>{tileB[0].headline || tileB[0].title}</Text>
              </LinearGradient>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
});

// ── Category carousel section (memoized) ───────────────────────────
const CategorySection = memo(function CategorySection({
  categories,
  onPressCategory,
}: {
  categories: Category[];
  onPressCategory: (cat: Category) => void;
}) {
  if (!categories.length) return null;
  return (
    <View style={styles.categoriesSection}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name="apps" size={20} color={Brand.primary} />
          <Text style={styles.sectionTitle}>Shop by Category</Text>
        </View>
        <Pressable onPress={() => onPressCategory(null as any)}>
          <Text style={styles.seeAllText}>View All ›</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryCarousel}
        removeClippedSubviews={true}
      >
        {categories.slice(0, 12).map((cat) => (
          <Pressable
            key={`cat-${cat.id}-${cat.slug}`}
            style={({ pressed }) => [styles.categoryItem, pressed && { opacity: 0.8 }]}
            onPress={() => onPressCategory(cat)}
          >
            <View style={styles.categoryCircle}>
              {cat.display_image ? (
                <Image
                  source={{ uri: cat.display_image }}
                  style={styles.categoryCircleImage}
                  contentFit="contain"
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
  );
});

// ── Horizontal product carousel section (memoized) ──────────────────
const ProductCarouselSection = memo(function ProductCarouselSection({
  icon,
  title,
  data,
  onPress,
}: {
  icon: string;
  title: string;
  data: Product[];
  onPress: (slug: string) => void;
}) {
  if (!data || data.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name={icon as any} size={22} color={Brand.primary} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselTrack}
        decelerationRate="fast"
        snapToInterval={160}
        snapToAlignment="start"
        removeClippedSubviews={true}
      >
        {data.map((item) => (
          <Pressable
            key={`${title}-${item.id}`}
            style={({ pressed }) => [styles.carouselCard, pressed && styles.cardPressed]}
            onPress={() => onPress(item.slug)}
          >
            <View style={styles.carouselImageWrap}>
              {item.primary_image_url ? (
                <Image source={{ uri: item.primary_image_url }} style={styles.carouselImage} contentFit="contain" transition={200} />
              ) : (
                <View style={styles.noImage}><MaterialCommunityIcons name="image-outline" size={32} color={Brand.textTertiary} /></View>
              )}
              {item.is_on_sale && (
                <View style={styles.saleBadge}><Text style={styles.saleBadgeText}>-{item.discount_percentage}%</Text></View>
              )}
            </View>
            <Text style={styles.carouselName} numberOfLines={2}>{item.name}</Text>
            <View style={styles.carouselPriceRow}>
              <Text style={styles.currency}>{item.currency}</Text>
              <Text style={styles.carouselPrice}>{Number(item.final_price).toLocaleString()}</Text>
            </View>
            {item.is_on_sale && (
              <Text style={styles.carouselOrigPrice}>{item.currency} {Number(item.price).toLocaleString()}</Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
});

// ── Top Stores section (memoized) ───────────────────────────────────
const TopStoresSection = memo(function TopStoresSection({
  stores,
  onPressStore,
  onPressSeeAll,
}: {
  stores: Store[];
  onPressStore: (slug: string) => void;
  onPressSeeAll: () => void;
}) {
  if (!stores.length) return null;
  return (
    <View style={styles.storesSection}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name="store" size={20} color={Brand.primary} />
          <Text style={styles.sectionTitle}>Top Stores</Text>
        </View>
        <Pressable onPress={onPressSeeAll}>
          <Text style={styles.seeAllText}>View All ›</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storesCarousel}
        removeClippedSubviews={true}
      >
        {stores.map((s) => (
          <Pressable
            key={s.id}
            style={styles.storeCard}
            onPress={() => onPressStore(s.slug)}
          >
            <View style={styles.storeLogoWrap}>
              {s.logo_url ? (
                <Image source={{ uri: s.logo_url }} style={styles.storeLogo} contentFit="contain" />
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
  );
});

// ── Top Brands section (memoized) ───────────────────────────────────
const TopBrandsSection = memo(function TopBrandsSection({
  brands,
  onPressBrand,
}: {
  brands: BrandType[];
  onPressBrand: (slug: string, name: string) => void;
}) {
  if (!brands.length) return null;
  return (
    <View style={styles.brandsSection}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name="certificate" size={20} color={Brand.primary} />
          <Text style={styles.sectionTitle}>Popular Brands</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.brandsScroll}
        removeClippedSubviews={true}
      >
        {brands.map((b) => (
          <Pressable
            key={`brand-${b.id}`}
            style={({ pressed }) => [styles.brandCard, pressed && { opacity: 0.85 }]}
            onPress={() => onPressBrand(b.slug, b.name)}
          >
            <View style={styles.brandLogoWrap}>
              {b.logo_url ? (
                <Image
                  source={{ uri: b.logo_url }}
                  style={styles.brandLogo}
                  contentFit="contain"
                  transition={150}
                />
              ) : (
                <View style={styles.brandLogoFallback}>
                  <MaterialCommunityIcons name="tag" size={22} color={Brand.primary} />
                </View>
              )}
            </View>
            <Text style={styles.brandName} numberOfLines={1}>{b.name}</Text>
            <Text style={styles.brandCount}>{b.product_count} products</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
});

// ── Supplier banner (memoized) ──────────────────────────────────────
const SupplierBanner = memo(function SupplierBanner({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.supplierBanner, pressed && { opacity: 0.9 }]}
      onPress={onPress}
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
  const [notificationCount, setNotificationCount] = useState(0);
  const { cartCount, refreshCartCount } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Section data
  const [deals, setDeals] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [topStores, setTopStores] = useState<Store[]>([]);
  const [topBrands, setTopBrands] = useState<BrandType[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [flashSale, setFlashSale] = useState<Product[]>([]);
  const [flashEndsAt, setFlashEndsAt] = useState<string | null>(null);
  const [vouchers, setVouchers] = useState<ClaimableCoupon[]>([]);
  const [tileA, setTileA] = useState<Slide[]>([]);
  const [tileB, setTileB] = useState<Slide[]>([]);
  const [becauseYouViewed, setBecauseYouViewed] = useState<Product[]>([]);

  // ── Cloudinary image sizes per component layout ─────────────────
  const productCardSize = useImageDimensions('productCard');
  const categorySize = useImageDimensions('category');
  const slideSize = useImageDimensions('slide');
  const storeLogoSize = useImageDimensions('storeLogo');
  const brandSize = useImageDimensions('category');

  // ── Load all sections in parallel ────────────────────────────────
  const loadAllSections = useCallback(async () => {
    try {
      const [
        dealsRes, newArrRes, featRes, stores, slideData, brandsData,
        flashRes, voucherData, tileAData, tileBData, becauseData,
      ] = await Promise.all([
        fetchProducts({ on_sale: 'true', page: 1, ...productCardSize }).catch((e) => { console.error('[Home] deals error:', e?.message); return { results: [] as Product[], next: null }; }),
        fetchProducts({ new_arrival: 'true', page: 1, ...productCardSize }).catch((e) => { console.error('[Home] newArr error:', e?.message); return { results: [] as Product[], next: null }; }),
        fetchProducts({ featured: 'true', page: 1, ...productCardSize }).catch((e) => { console.error('[Home] feat error:', e?.message); return { results: [] as Product[], next: null }; }),
        fetchTopStores(storeLogoSize).catch((e) => { console.error('[Home] stores error:', e?.message); return [] as Store[]; }),
        fetchSlides(undefined, slideSize).catch((e) => { console.error('[Home] slides error:', e?.message); return [] as Slide[]; }),
        fetchTopBrands(brandSize).catch((e) => { console.error('[Home] brands error:', e?.message); return [] as BrandType[]; }),
        fetchFlashSaleProducts(1, productCardSize).catch((e) => { console.error('[Home] flash error:', e?.message); return { results: [] as Product[] }; }),
        fetchClaimableCoupons().catch((e) => { console.error('[Home] vouchers error:', e?.message); return [] as ClaimableCoupon[]; }),
        fetchSlides('tile_a' as SlidePosition, slideSize).catch((e) => { console.error('[Home] tileA error:', e?.message); return [] as Slide[]; }),
        fetchSlides('tile_b' as SlidePosition, slideSize).catch((e) => { console.error('[Home] tileB error:', e?.message); return [] as Slide[]; }),
        fetchBecauseYouViewed(productCardSize).catch((e) => { console.error('[Home] because error:', e?.message); return [] as Product[]; }),
      ]);
      setDeals(dealsRes.results.slice(0, 10));
      setNewArrivals(newArrRes.results.slice(0, 10));
      setRecommended(featRes.results.slice(0, 10));
      setTopStores(stores.slice(0, 10));
      setSlides(slideData);
      setTopBrands(brandsData);
      setFlashSale(flashRes.results.slice(0, 10));
      // Use the earliest active flash_sale_ends_at for the countdown
      const ends = flashRes.results
        .map((p) => p.flash_sale_ends_at)
        .filter((v): v is string => !!v)
        .sort()[0] || null;
      setFlashEndsAt(ends);
      setVouchers(voucherData.slice(0, 4));
      setTileA(tileAData);
      setTileB(tileBData);
      setBecauseYouViewed(becauseData.slice(0, 10));
      console.log('[Home] Slides loaded:', slideData.length, slideData.map(s => s.title));

      // Load recently viewed from local storage as a fallback
      try {
        const raw = await AsyncStorage.getItem('recently_viewed');
        if (raw) {
          const local: Product[] = JSON.parse(raw);
          setRecentlyViewed((prev) => (prev.length ? prev : local));
        }
      } catch { }

      // Also fetch server-backed recently viewed (overrides local if present)
      try {
        const serverRecent = await fetchRecentlyViewed();
        if (serverRecent.length) setRecentlyViewed(serverRecent.slice(0, 10));
      } catch { }
    } catch (e) {
      // Sections are optional — main grid still loads
    }
  }, [productCardSize, slideSize, categorySize, storeLogoSize, brandSize]);

  // ── Load categories from API ─────────────────────────────────────
  const loadCategories = useCallback(async () => {
    try {
      const cats = await fetchCategories(categorySize);
      // Sort by product_count descending so most relevant categories show first
      cats.sort((a, b) => (b.product_count || 0) - (a.product_count || 0));
      setCategories(cats);
    } catch (e) {
      // Categories are optional
    }
  }, [categorySize]);

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
      const params: Record<string, any> = { page: targetPage, ...productCardSize };
      if (activeCategory) params.category = activeCategory;
      const data = await fetchProducts(params);
      setProducts((prev) => {
        if (reset) return data.results;
        // Defensive dedup: drop items already present to avoid duplicate
        // keys when loadMore fires before page state has advanced.
        const existingIds = new Set(prev.map((p) => p.id));
        const fresh = data.results.filter((p) => !existingIds.has(p.id));
        return [...prev, ...fresh];
      });
      setHasMore(data.next !== null);
      // Always advance page — for reset, targetPage is 1 so next is 2.
      // Previously guarded by `if (!reset)`, which left page at 1 after
      // reset and caused loadMore to re-fetch page 1 (duplicate items).
      setPage(targetPage + 1);
    } catch (e: any) {
      // Only show error screen if we have no products at all
      // If we already have products, keep showing them (transient error)
      const msg = e?.response?.data?.detail || e?.message || 'Failed to load products';
      setProducts((prev) => {
        if (prev.length === 0) setError(msg);
        return prev;
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [page, activeCategory, productCardSize]);

  // Initial load with auto-retry
  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    loadProducts(true);
    loadAllSections();
    loadCategories();
    // Auto-retry after 3s if products still empty (handles transient network errors)
    const retryTimer = setTimeout(() => {
      setProducts((prev) => {
        if (prev.length === 0) loadProducts(true);
        return prev;
      });
    }, 3000);
    return () => clearTimeout(retryTimer);
  }, []);

  // ── Refresh cart count and chat unread when screen gains focus ──
  const loadNotificationCount = useCallback(async () => {
    if (!isAuthenticated) { setNotificationCount(0); return; }
    try {
      const count = await fetchUnreadNotificationCount();
      setNotificationCount(count);
    } catch {
      setNotificationCount(0);
    }
  }, [isAuthenticated]);

  // Refresh cart count, chat unread, and notification count every time
  // the home screen gains focus. The three requests are independent so
  // we fan them out in parallel via Promise.all — this avoids serial
  // round-trips that add up on slow networks.
  useFocusEffect(
    useCallback(() => {
      // refreshCartCount comes from useCart(); it's sync-ish but we still
      // kick it off alongside the two async badge fetches.
      refreshCartCount();
      Promise.all([loadNotificationCount()]).catch(() => { });
    }, [refreshCartCount, loadNotificationCount])
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

  // ── Scroll tracking + scroll-to-top (throttled to avoid re-renders) ─
  const scrollTopRef = useRef(false);
  const lastScrollUpdate = useRef(0);
  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const shouldShow = offsetY > 300;
    const now = Date.now();
    if (now - lastScrollUpdate.current < 150 && scrollTopRef.current === shouldShow) return;
    lastScrollUpdate.current = now;
    if (scrollTopRef.current !== shouldShow) {
      scrollTopRef.current = shouldShow;
      setShowScrollTop(shouldShow);
    }
  }, []);

  const scrollToTop = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // ── Horizontal carousel card (compact) ───────────────────────────
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

  const handleSlidePress = useCallback((slide: Slide) => {
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
  }, [router]);

  const handleCategoryPress = useCallback((cat: Category | null) => {
    if (cat) {
      router.push({ pathname: '/search', params: { category: cat.slug, categoryName: cat.name } } as any);
    } else {
      router.push('/categories' as any);
    }
  }, [router]);

  const handleStorePress = useCallback((slug: string) => {
    router.push(`/store/${slug}` as any);
  }, [router]);

  const handleBrandPress = useCallback((slug: string, name: string) => {
    router.push({ pathname: '/search', params: { brand: slug, brandName: name } } as any);
  }, [router]);

  const handleSearchPress = useCallback(() => {
    router.push('/search');
  }, [router]);

  const handleSuppliersPress = useCallback(() => {
    router.push('/suppliers');
  }, [router]);

  const renderProduct = useCallback(
    ({ item }: { item: Product }) => (
      <ProductCard item={item} onPress={handleProductPress} onChat={handleChat} />
    ),
    [handleProductPress, handleChat]
  );

  const renderHeader = useCallback(() => (
    <View>
      {/* Search bar */}
      <Pressable
        style={({ pressed }) => [styles.searchBar, pressed && styles.searchBarPressed]}
        onPress={handleSearchPress}
      >
        <MaterialCommunityIcons name="magnify" size={26} color={Brand.textTertiary} />
        <Text style={styles.searchPlaceholder}>Search Diilzo</Text>
        <View style={styles.searchIconRight}>
          <MaterialCommunityIcons name="camera-outline" size={26} color={Brand.primary} />
        </View>
      </Pressable>

      {/* ── Homepage carousel ─────────────────────────────────────── */}
      <HomeCarousel slides={slides} />

      {/* ── Flash Sale shelf with live countdown ─────────────────── */}
      <FlashSaleShelf products={flashSale} endsAt={flashEndsAt} onPress={handleProductPress} />

      {/* ── Shop by Category ────────────────────────────────────────── */}
      <CategorySection categories={categories} onPressCategory={handleCategoryPress} />

      {/* ── Today's Deals ─────────────────────────────────────────── */}
      <ProductCarouselSection icon="fire" title="Today's Deals" data={deals} onPress={handleProductPress} />

      {/* ── Voucher banner (claimable coupons) ───────────────────── */}
      <VoucherBanner vouchers={vouchers} />

      {/* ── Dual promo banner tiles ──────────────────────────────── */}
      <DualBannerTiles tileA={tileA} tileB={tileB} onPress={handleSlidePress} />

      {/* ── New Arrivals ─────────────────────────────────────────── */}
      <ProductCarouselSection icon="package-variant-closed" title="New Arrivals" data={newArrivals} onPress={handleProductPress} />

      {/* ── Recommended for You ──────────────────────────────────── */}
      <ProductCarouselSection icon="thumb-up-outline" title="Recommended for You" data={recommended} onPress={handleProductPress} />

      {/* ── Because You Viewed ───────────────────────────────────── */}
      <ProductCarouselSection icon="lightbulb-on-outline" title="Because You Viewed" data={becauseYouViewed} onPress={handleProductPress} />

      {/* ── Recently Viewed ──────────────────────────────────────── */}
      <ProductCarouselSection icon="history" title="Recently Viewed" data={recentlyViewed} onPress={handleProductPress} />

      {/* ── Top Stores ───────────────────────────────────────────── */}
      <TopStoresSection stores={topStores} onPressStore={handleStorePress} onPressSeeAll={handleSuppliersPress} />

      {/* ── Supplier banner ──────────────────────────────────────── */}
      <SupplierBanner onPress={handleSuppliersPress} />

      {/* ── Top Brands ───────────────────────────────────────────── */}
      <TopBrandsSection brands={topBrands} onPressBrand={handleBrandPress} />

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
  ), [slides, flashSale, flashEndsAt, handleProductPress, categories, handleCategoryPress,
    deals, newArrivals, recommended, becauseYouViewed, recentlyViewed,
    vouchers, tileA, tileB, handleSlidePress, topStores, handleStorePress,
    handleSuppliersPress, topBrands, handleBrandPress, handleSearchPress, activeCategory]);

  if (loading && products.length === 0) {
    return (
      <View style={styles.screen}>
        <LinearGradient colors={[Brand.dark, Brand.accent, Brand.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBg}>
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.headerBar}>
              <DiilzoLogo size={22} variant="color" />
              <Pressable
                style={({ pressed }) => [styles.cartIcon, pressed && styles.iconPressed]}
                onPress={() => router.push('/cart')}
              >
                <MaterialCommunityIcons name="cart-outline" size={22} color={Brand.dark} />
                {cartCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.notifBtn, pressed && styles.iconPressed]}
                onPress={() => router.push('/account')}
              >
                <MaterialCommunityIcons name="bell" size={20} color={Brand.dark} />
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
                <View style={styles.avatarRing}>
                  {isAuthenticated && user?.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <MaterialCommunityIcons name="account" size={18} color={Brand.dark} />
                    </View>
                  )}
                </View>
              </Pressable>
            </View>
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
        <LinearGradient colors={[Brand.dark, Brand.accent, Brand.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBg}>
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.headerBar}>
              <DiilzoLogo size={22} variant="color" />
              <Pressable
                style={({ pressed }) => [styles.cartIcon, pressed && styles.iconPressed]}
                onPress={() => router.push('/cart')}
              >
                <MaterialCommunityIcons name="cart-outline" size={22} color={Brand.dark} />
                {cartCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.notifBtn, pressed && styles.iconPressed]}
                onPress={() => router.push('/account')}
              >
                <MaterialCommunityIcons name="bell" size={20} color={Brand.dark} />
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
                <View style={styles.avatarRing}>
                  {isAuthenticated && user?.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <MaterialCommunityIcons name="account" size={18} color={Brand.dark} />
                    </View>
                  )}
                </View>
              </Pressable>
            </View>
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
      <LinearGradient colors={[Brand.dark, Brand.accent, Brand.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBg}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.headerBar}>
            {/* Logo on left */}
            <DiilzoLogo size={22} variant="color" />
            {/* Cart icon */}
            <Pressable
              style={({ pressed }) => [styles.cartIcon, pressed && styles.iconPressed]}
              onPress={() => router.push('/cart')}
            >
              <MaterialCommunityIcons name="cart-outline" size={22} color={Brand.dark} />
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                </View>
              )}
            </Pressable>
            {/* Notification bell */}
            <Pressable
              style={({ pressed }) => [styles.notifBtn, pressed && styles.iconPressed]}
              onPress={() => router.push('/account')}
            >
              <MaterialCommunityIcons name="bell" size={20} color={Brand.dark} />
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
              <View style={styles.avatarRing}>
                {isAuthenticated && user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <MaterialCommunityIcons name="account" size={18} color={Brand.dark} />
                  </View>
                )}
              </View>
            </Pressable>
          </View>
        </SafeAreaView >
      </LinearGradient >

      <FlatList
        ref={flatListRef}
        data={products}
        keyExtractor={(item) => `${item.id}-${item.slug}`}
        renderItem={renderProduct}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListHeaderComponent={renderHeader}
        maxToRenderPerBatch={4}
        windowSize={5}
        initialNumToRender={6}
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={50}
        onScroll={handleScroll}
        scrollEventThrottle={32}
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
    </View >
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 0, backgroundColor: 'transparent' },
  headerBg: {
    width: '100%',
  },

  // ── Header ──────────────────────────────────────────────────────
  headerBar: {
    width: '100%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
    color: Brand.dark,
    fontSize: 13,
    fontWeight: '600',
  },
  avatarRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Brand.primary,
    padding: 1.5,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: Brand.surfaceAlt,
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
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Brand.surface,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  slideImageWrap: {
    flex: 1,
    width: '100%',
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
  slideOverlay: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Brand.primary,
    minHeight: 52,
  },
  slideTextCol: {
    flex: 1,
    flexShrink: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingRight: 10,
  },
  slideHeadline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'left',
    marginBottom: 2,
  },
  slideSubheadline: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'left',
  },
  slideButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 4,
    flexShrink: 0,
    justifyContent: 'center',
  },
  slideButtonText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
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

  // ── Top Brands section ──────────────────────────────────────────
  brandsSection: {
    backgroundColor: '#FFFFFF',
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Brand.border,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  brandsScroll: { paddingHorizontal: Spacing.three, gap: 12 },
  brandCard: {
    width: 90,
    alignItems: 'center',
  },
  brandLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Brand.border,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  brandLogo: { width: '100%', height: '100%', padding: 6 },
  brandLogoFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#DCF5EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandName: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: Brand.text,
    textAlign: 'center',
  },
  brandCount: {
    fontSize: 10,
    color: Brand.textTertiary,
    marginTop: 1,
  },

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

  // ── Flash Sale shelf ─────────────────────────────────────────────
  flashSection: {
    marginHorizontal: Spacing.two,
    marginVertical: Spacing.two,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  flashHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  flashTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flashTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  countdownLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', marginRight: 4 },
  countdownBox: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countdownDigit: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  countdownColon: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  flashBadge: {
    position: 'absolute',
    top: Spacing.one,
    left: Spacing.one,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  flashBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  // ── Voucher banner ───────────────────────────────────────────────
  voucherSection: {
    backgroundColor: '#FFFFFF',
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
    marginHorizontal: Spacing.two,
    borderRadius: 16,
    paddingVertical: Spacing.two,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  voucherTrack: { paddingHorizontal: Spacing.two, gap: Spacing.two, paddingVertical: Spacing.one },
  voucherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.primary,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    minWidth: 240,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  voucherIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voucherBody: { flex: 1, gap: 1 },
  voucherCode: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  voucherDesc: { color: 'rgba(255,255,255,0.95)', fontSize: 12, fontWeight: '600' },
  voucherMin: { color: 'rgba(255,255,255,0.8)', fontSize: 10 },

  // ── Dual promo banner tiles ──────────────────────────────────────
  dualTilesWrap: {
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
  dualTilesRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dualTile: {
    flex: 1,
    aspectRatio: 2,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  dualTileImage: { width: '100%', height: '100%' },
  dualTileFallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', padding: 10 },
  dualTileText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textAlign: 'center' },
});
