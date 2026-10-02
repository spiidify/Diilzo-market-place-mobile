import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { GradientHeader } from '@/components/GradientHeader';
import { ScrollToTopButton } from '@/components/scroll-to-top';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { fetchStoresPage, submitRFQ } from '@/services/catalog';
import type { PaginatedResponse, Store } from '@/types';

const BUSINESS_TYPES = [
  { label: 'All', value: '' },
  { label: 'Manufacturers', value: 'manufacturer' },
  { label: 'Wholesalers', value: 'wholesaler' },
  { label: 'Distributors', value: 'distributor' },
  { label: 'Retailers', value: 'retailer' },
];

const BUSINESS_ICONS: Record<string, string> = {
  manufacturer: 'factory',
  wholesaler: 'warehouse',
  distributor: 'truck-delivery',
  trading_company: 'swap-horizontal',
  retailer: 'store',
  individual: 'account',
};

export default function SuppliersScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ rfq?: string; product_name?: string; store?: string }>();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState('');
  const [wholesalerOnly, setWholesalerOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ── RFQ modal state ──────────────────────────────────────────────
  const [rfqOpen, setRfqOpen] = useState(false);
  const [rfqName, setRfqName] = useState('');
  const [rfqEmail, setRfqEmail] = useState('');
  const [rfqPhone, setRfqPhone] = useState('');
  const [rfqProduct, setRfqProduct] = useState('');
  const [rfqQty, setRfqQty] = useState('1');
  const [rfqTarget, setRfqTarget] = useState('');
  const [rfqMessage, setRfqMessage] = useState('');
  const [rfqSubmitting, setRfqSubmitting] = useState(false);
  const [rfqSuccess, setRfqSuccess] = useState(false);
  const [rfqError, setRfqError] = useState<string | null>(null);

  // Open RFQ modal automatically when navigated with ?rfq=1
  useEffect(() => {
    if (params.rfq === '1') {
      if (params.product_name) setRfqProduct(String(params.product_name));
      setRfqOpen(true);
    }
  }, [params.rfq, params.product_name]);

  const submitRfqForm = useCallback(async () => {
    setRfqError(null);
    if (!rfqName.trim()) { setRfqError('Please enter your name'); return; }
    if (!rfqProduct.trim()) { setRfqError('Please enter the product name'); return; }
    setRfqSubmitting(true);
    try {
      await submitRFQ({
        name: rfqName.trim(),
        email: rfqEmail.trim(),
        phone: rfqPhone.trim(),
        product_name: rfqProduct.trim(),
        quantity: parseInt(rfqQty, 10) || 1,
        target_price: rfqTarget ? parseFloat(rfqTarget) : null,
        message: rfqMessage.trim(),
      });
      setRfqSuccess(true);
    } catch (e: any) {
      setRfqError(e?.response?.data?.detail || e?.message || 'Failed to submit');
    } finally {
      setRfqSubmitting(false);
    }
  }, [rfqName, rfqEmail, rfqPhone, rfqProduct, rfqQty, rfqTarget, rfqMessage]);

  const closeRfq = useCallback(() => {
    setRfqOpen(false);
    setRfqSuccess(false);
    setRfqError(null);
  }, []);

  const load = useCallback(async (reset = false) => {
    const targetPage = reset ? 1 : page;
    if (reset) {
      setPage(1);
      setHasMore(true);
    }
    try {
      if (reset) {
        setError(null);
        setRefreshing(true);
      } else {
        setLoadingMore(true);
      }

      const params: Record<string, any> = { page: targetPage };
      if (search) params.search = search;
      if (wholesalerOnly) params.wholesaler = 'true';

      const data: PaginatedResponse<Store> = await fetchStoresPage(params);
      let results = data.results || (Array.isArray(data) ? data : []);
      if (activeType) {
        results = results.filter((s) => s.business_type === activeType);
      }

      setStores((prev) => {
        if (reset) return results;
        const existingIds = new Set(prev.map((s) => s.id));
        const fresh = results.filter((s) => !existingIds.has(s.id));
        return [...prev, ...fresh];
      });
      setCount(data.count);
      setHasMore(data.next !== null);
      setPage(targetPage + 1);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [page, search, activeType, wholesalerOnly]);

  useEffect(() => {
    const t = setTimeout(() => load(true), 400);
    return () => clearTimeout(t);
  }, [search, activeType, wholesalerOnly]);

  useEffect(() => {
    load(true);
  }, []);

  const onRefresh = useCallback(() => load(true), [load]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || refreshing) return;
    load(false);
  }, [hasMore, loadingMore, refreshing, load]);

  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<FlatList>(null);

  const handleScroll = useCallback((event: any) => {
    setShowScrollTop(event.nativeEvent.contentOffset.y > 300);
  }, []);

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const renderStore = ({ item }: { item: Store }) => {
    const icon = BUSINESS_ICONS[item.business_type || 'individual'] || 'store';
    const isSupplier = item.is_wholesaler;
    const rating = item.rating ? parseFloat(item.rating) : 0;
    const verified = item.verification_status === 'gold' || item.verification_status === 'verified';
    const businessLabel = item.business_type
      ? item.business_type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Store';

    return (
      <Pressable
        style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}
        onPress={() => router.push(`/store/${item.slug}` as any)}
      >
        {/* Logo tile with verification badge */}
        <View style={styles.tileLogoWrap}>
          {item.logo_url ? (
            <Image source={{ uri: item.logo_url }} style={styles.tileLogo} resizeMode="cover" />
          ) : item.banner_url ? (
            <Image source={{ uri: item.banner_url }} style={styles.tileLogo} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={[Brand.dark, Brand.accent, Brand.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tileLogoFallback}
            >
              <MaterialCommunityIcons name={isSupplier ? 'factory' : (icon as any)} size={26} color="rgba(255,255,255,0.85)" />
            </LinearGradient>
          )}
          {verified && (
            <View style={styles.tileBadge}>
              <MaterialCommunityIcons
                name={item.verification_status === 'gold' ? 'crown' : 'check-decagram'}
                size={10}
                color="#FFFFFF"
              />
            </View>
          )}
          {isSupplier && !verified && (
            <View style={[styles.tileBadge, { backgroundColor: '#0EA5E9' }]}>
              <MaterialCommunityIcons name="shield-check" size={10} color="#FFFFFF" />
            </View>
          )}
        </View>

        <Text style={styles.tileName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.tileMetaRow}>
          <MaterialCommunityIcons name={icon as any} size={11} color={Brand.primary} />
          <Text style={styles.tileType} numberOfLines={1}>{businessLabel}</Text>
        </View>
        <View style={styles.tileMetaRow}>
          <MaterialCommunityIcons name="star" size={11} color={Brand.rating} />
          <Text style={styles.tileMetaText}>{rating > 0 ? rating.toFixed(1) : 'New'}</Text>
          {!!item.city && (
            <Text style={styles.tileMetaText} numberOfLines={1}> · {item.city}</Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <GradientHeader title="Suppliers & Manufacturers" />

      {/* ── Search bar (white) ──────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search suppliers, products..."
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Filter bar (white) ──────────────────────────────────── */}
      <View style={styles.filterBar}>
        {/* Stats inline */}
        <View style={styles.filterStats}>
          <Text style={styles.filterStatNum}>{count}</Text>
          <Text style={styles.filterStatLabel}>suppliers found</Text>
        </View>
        {/* Business type chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}
        >
          {BUSINESS_TYPES.map((type) => (
            <Pressable
              key={type.value}
              style={[
                styles.filterChip,
                activeType === type.value ? styles.filterChipActive : styles.filterChipInactive,
              ]}
              onPress={() => setActiveType(type.value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeType === type.value ? styles.filterChipTextActive : styles.filterChipTextInactive,
                ]}
              >
                {type.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[
              styles.filterChip,
              wholesalerOnly ? styles.filterChipActive : styles.filterChipInactive,
            ]}
            onPress={() => setWholesalerOnly((v) => !v)}
          >
            <MaterialCommunityIcons
              name="shield-check"
              size={14}
              color={wholesalerOnly ? '#FFFFFF' : Brand.primary}
            />
            <Text
              style={[
                styles.filterChipText,
                wholesalerOnly ? styles.filterChipTextActive : styles.filterChipTextInactive,
              ]}
            >
              Trade Assurance
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* ── Loading ─────────────────────────────────────────────── */}
      {loading && stores.length === 0 ? (
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
          <Text style={styles.loadingText}>Loading suppliers...</Text>
        </View>
      ) : error && stores.length === 0 ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load(true)}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : stores.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <MaterialCommunityIcons name="store-off-outline" size={48} color={colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No suppliers found</Text>
          <Text style={styles.emptySubtext}>Try adjusting your filters or search</Text>
          <Pressable
            style={styles.emptyBtn}
            onPress={() => { setSearch(''); setActiveType(''); setWholesalerOnly(false); }}
          >
            <Text style={styles.emptyBtnText}>Clear Filters</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          key="suppliers-grid-3"
          data={stores}
          keyExtractor={(item) => `${item.id}-${item.slug}`}
          renderItem={renderStore}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.list}
          maxToRenderPerBatch={9}
          windowSize={9}
          initialNumToRender={12}
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
              <Text style={styles.endText}>You've seen all {count} suppliers</Text>
            ) : null
          }
        />
      )}
      <ScrollToTopButton visible={showScrollTop} onPress={scrollToTop} />

      {/* ── Floating RFQ button ─────────────────────────────────── */}
      <Pressable
        style={({ pressed }) => [styles.rfqFab, pressed && { opacity: 0.9 }]}
        onPress={() => setRfqOpen(true)}
      >
        <MaterialCommunityIcons name="file-document-edit-outline" size={22} color="#FFFFFF" />
        <Text style={styles.rfqFabText}>RFQ</Text>
      </Pressable>

      {/* ── RFQ Modal ───────────────────────────────────────────── */}
      <Modal visible={rfqOpen} animationType="slide" transparent onRequestClose={closeRfq}>
        <View style={styles.rfqModalOverlay}>
          <View style={styles.rfqModalCard}>
            {rfqSuccess ? (
              <View style={styles.rfqSuccessWrap}>
                <MaterialCommunityIcons name="check-circle" size={56} color={Brand.success} />
                <Text style={styles.rfqSuccessTitle}>Request Submitted!</Text>
                <Text style={styles.rfqSuccessSub}>
                  Suppliers will contact you with quotes shortly.
                </Text>
                <Pressable style={styles.rfqCloseBtn} onPress={closeRfq}>
                  <Text style={styles.rfqCloseBtnText}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.rfqModalHeader}>
                  <Text style={styles.rfqModalTitle}>Request for Quotation</Text>
                  <Pressable onPress={closeRfq} hitSlop={8}>
                    <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.rfqForm}>
                  <Text style={styles.rfqLabel}>Your Name *</Text>
                  <TextInput style={styles.rfqInput} value={rfqName} onChangeText={setRfqName} placeholder="John Doe" />
                  <Text style={styles.rfqLabel}>Email</Text>
                  <TextInput style={styles.rfqInput} value={rfqEmail} onChangeText={setRfqEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
                  <Text style={styles.rfqLabel}>Phone</Text>
                  <TextInput style={styles.rfqInput} value={rfqPhone} onChangeText={setRfqPhone} placeholder="+254 7XX XXX XXX" keyboardType="phone-pad" />
                  <Text style={styles.rfqLabel}>Product Name *</Text>
                  <TextInput style={styles.rfqInput} value={rfqProduct} onChangeText={setRfqProduct} placeholder="What are you sourcing?" />
                  <View style={styles.rfqRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rfqLabel}>Quantity</Text>
                      <TextInput style={styles.rfqInput} value={rfqQty} onChangeText={setRfqQty} placeholder="100" keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.rfqLabel}>Target Price</Text>
                      <TextInput style={styles.rfqInput} value={rfqTarget} onChangeText={setRfqTarget} placeholder="Optional" keyboardType="numeric" />
                    </View>
                  </View>
                  <Text style={styles.rfqLabel}>Message</Text>
                  <TextInput
                    style={[styles.rfqInput, styles.rfqTextarea]}
                    value={rfqMessage}
                    onChangeText={setRfqMessage}
                    placeholder="Specifications, delivery timeline, etc."
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  {rfqError && <Text style={styles.rfqErrorText}>{rfqError}</Text>}
                  <Pressable
                    style={({ pressed }) => [styles.rfqSubmitBtn, pressed && { opacity: 0.9 }]}
                    onPress={submitRfqForm}
                    disabled={rfqSubmitting}
                  >
                    {rfqSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.rfqSubmitBtnText}>Submit Request</Text>
                    )}
                  </Pressable>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },

  // ── Search bar (white, below gradient header) ───────────────────
  searchWrap: {
    backgroundColor: c.surface,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: c.text, paddingVertical: 0, height: '100%' },

  // ── Filter bar ──────────────────────────────────────────────────
  filterBar: {
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  filterStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  filterStatNum: { fontSize: 15, fontWeight: '800', color: c.text },
  filterStatLabel: { fontSize: 12, color: c.textSecondary },
  filterChips: { paddingHorizontal: 8, paddingVertical: 10, gap: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  filterChipInactive: { backgroundColor: c.surfaceAlt, borderColor: c.borderLight },
  filterChipText: { fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#FFFFFF' },
  filterChipTextInactive: { color: c.textSecondary },

  // ── Grid ────────────────────────────────────────────────────────
  list: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 20 },
  gridRow: { gap: 8, marginBottom: 8 },
  tile: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: c.borderLight,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tileLogoWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 7,
  },
  tileLogo: { width: '100%', height: '100%' },
  tileLogoFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tileBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: c.surface,
  },
  tileName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: c.text,
    textAlign: 'center',
    lineHeight: 15,
    minHeight: 30,
  },
  tileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginTop: 2,
  },
  tileType: { fontSize: 10, color: Brand.primary, fontWeight: '600' },
  tileMetaText: { fontSize: 10, color: c.textTertiary },

  // ── States ──────────────────────────────────────────────────────
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, color: c.textSecondary, fontSize: 14 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: c.surfaceAlt,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  emptySubtext: { marginTop: 8, fontSize: 14, color: c.textSecondary, textAlign: 'center' },
  emptyBtn: {
    marginTop: 20, backgroundColor: Brand.primary,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
  },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  footer: { paddingVertical: 16 },
  endText: { textAlign: 'center', paddingVertical: 16, color: c.textTertiary, fontSize: 13 },

  // ── RFQ floating button ──────────────────────────────────────────
  rfqFab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Brand.primary,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 28,
    elevation: 6,
    shadowColor: Brand.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  rfqFabText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  // ── RFQ Modal ────────────────────────────────────────────────────
  rfqModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  rfqModalCard: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  rfqModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  rfqModalTitle: { fontSize: 17, fontWeight: '800', color: c.text },
  rfqForm: { paddingHorizontal: 8, paddingTop: 12, gap: 4 },
  rfqLabel: { fontSize: 12, fontWeight: '600', color: c.textSecondary, marginTop: 8, marginBottom: 2 },
  rfqInput: {
    borderWidth: 1,
    borderColor: c.borderLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: c.text,
    backgroundColor: c.surfaceAlt,
  },
  rfqTextarea: { minHeight: 70 },
  rfqRow: { flexDirection: 'row' },
  rfqErrorText: { color: Brand.danger, fontSize: 12, marginTop: 8, fontWeight: '600' },
  rfqSubmitBtn: {
    backgroundColor: Brand.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  rfqSubmitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  rfqSuccessWrap: { alignItems: 'center', padding: 30, gap: 8 },
  rfqSuccessTitle: { fontSize: 18, fontWeight: '800', color: c.text, marginTop: 8 },
  rfqSuccessSub: { fontSize: 13, color: c.textSecondary, textAlign: 'center' },
  rfqCloseBtn: {
    backgroundColor: Brand.primary,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
    marginTop: 16,
  },
  rfqCloseBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
