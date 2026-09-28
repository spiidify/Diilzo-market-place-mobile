import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { Brand, Spacing } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { fetchBrands, fetchCategories } from '@/services/catalog';
import { deleteProduct, getMyProducts, updateStock } from '@/services/seller';
import type { Brand as BrandType, Category } from '@/types';

type SortOption = 'newest' | 'price_low' | 'price_high' | 'name' | 'stock_low';
type StockFilter = 'all' | 'in' | 'out' | 'low';
type ActiveFilter = 'all' | 'true' | 'false';

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Newest', value: 'newest' },
  { label: 'Price: Low to High', value: 'price_low' },
  { label: 'Price: High to Low', value: 'price_high' },
  { label: 'Name: A to Z', value: 'name' },
  { label: 'Lowest Stock', value: 'stock_low' },
];

const STOCK_OPTIONS: { label: string; value: StockFilter }[] = [
  { label: 'All Stock', value: 'all' },
  { label: 'In Stock', value: 'in' },
  { label: 'Low Stock', value: 'low' },
  { label: 'Out of Stock', value: 'out' },
];

const ACTIVE_OPTIONS: { label: string; value: ActiveFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
];

export default function SellerProductsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Search & filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [brandId, setBrandId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Dropdown data
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<BrandType[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);

  // Quick stock modal
  const [stockModalItem, setStockModalItem] = useState<any | null>(null);
  const [quickStockVal, setQuickStockVal] = useState('');
  const [updatingStock, setUpdatingStock] = useState(false);

  const openQuickStock = (item: any) => {
    setStockModalItem(item);
    setQuickStockVal(String(item.stock_quantity ?? 0));
  };

  const handleSaveQuickStock = async () => {
    if (!stockModalItem) return;
    const newQty = parseInt(quickStockVal, 10);
    if (isNaN(newQty) || newQty < 0) {
      Alert.alert('Invalid Stock', 'Please enter a valid stock quantity.');
      return;
    }
    try {
      setUpdatingStock(true);
      await updateStock(stockModalItem.id, newQty);
      setProducts((prev) =>
        prev.map((p) => (p.id === stockModalItem.id ? { ...p, stock_quantity: newQty } : p))
      );
      setStockModalItem(null);
    } catch (err: any) {
      Alert.alert('Update Error', err?.message || 'Failed to update stock');
    } finally {
      setUpdatingStock(false);
    }
  };

  const loadMeta = useCallback(async () => {
    try {
      const [cats, brs] = await Promise.all([fetchCategories(), fetchBrands()]);
      setCategories(cats);
      setBrands(brs);
    } catch {
      // Non-critical
    }
  }, []);

  const load = useCallback(async (pageNum = 1, append = false) => {
    try {
      setError(null);
      if (append) setLoadingMore(true); else setRefreshing(true);
      const params: any = { sort, page: pageNum, page_size: 20 };
      if (search) params.search = search;
      if (stockFilter !== 'all') params.stock = stockFilter;
      if (activeFilter !== 'all') params.active = activeFilter;
      if (categoryId) params.category = String(categoryId);
      if (brandId) params.brand = String(brandId);
      const data = await getMyProducts(params);
      setProducts((prev) => (append ? [...prev, ...data] : data));
      setHasMore(!!(data as any).next);
      setTotalCount((data as any).count ?? data.length);
      setPage(pageNum);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [search, sort, stockFilter, activeFilter, categoryId, brandId]);

  const loadMore = useCallback(() => {
    if (loading || refreshing || loadingMore || !hasMore) return;
    load(page + 1, true);
  }, [load, page, hasMore, loading, refreshing, loadingMore]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => { load(); }, [load]);

  const handleSearchSubmit = () => {
    setSearch(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
  };

  const resetFilters = () => {
    setSort('newest');
    setStockFilter('all');
    setActiveFilter('all');
    setCategoryId(null);
    setBrandId(null);
    setSearch('');
    setSearchInput('');
  };

  const activeFilterCount = (stockFilter !== 'all' ? 1 : 0)
    + (activeFilter !== 'all' ? 1 : 0)
    + (categoryId ? 1 : 0)
    + (brandId ? 1 : 0)
    + (search ? 1 : 0);

  const handleDelete = (item: any) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${item.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(item.id);
            try {
              await deleteProduct(item.id);
              setProducts((prev) => prev.filter((p) => p.id !== item.id));
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || 'Failed to delete product');
            } finally {
              setDeleting(null);
            }
          },
        },
      ],
    );
  };

  const handleToggleActive = (item: any) => {
    Alert.alert(
      item.is_active ? 'Deactivate Product' : 'Activate Product',
      item.is_active
        ? 'This product will no longer be visible to buyers.'
        : 'This product will be visible to buyers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const formData = new FormData();
              formData.append('is_active', item.is_active ? 'false' : 'true');
              const { updateProduct } = await import('@/services/seller');
              await updateProduct(item.id, formData);
              setProducts((prev) =>
                prev.map((p) => (p.id === item.id ? { ...p, is_active: !p.is_active } : p))
              );
            } catch {
              Alert.alert('Error', 'Failed to update product');
            }
          },
        },
      ],
    );
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedBrand = brands.find((b) => b.id === brandId);

  const renderItem = ({ item }: { item: any }) => {
    const stock = Number(item.stock_quantity ?? 0);
    const stockColor = stock === 0 ? Brand.danger : stock <= 5 ? Brand.rating : colors.textTertiary;
    return (
      <View style={styles.item}>
        <Pressable
          style={({ pressed }) => [styles.itemMain, pressed && { opacity: 0.8 }]}
          onPress={() => router.push(`/seller/products/edit?id=${item.id}` as any)}
        >
          {(item.primary_image_url || item.primary_image) ? (
            <Image source={{ uri: item.primary_image_url || item.primary_image }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <View style={styles.productImageFallback}>
              <MaterialCommunityIcons name="package-variant" size={20} color={colors.textTertiary} />
            </View>
          )}
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.productMeta}>
              <Text style={styles.productPrice}>UGX {Number(item.final_price || item.price).toLocaleString()}</Text>
              <View style={[styles.statusDot, { backgroundColor: item.is_active ? Brand.primary : colors.textTertiary }]} />
              <Text style={styles.productStatus}>{item.is_active ? 'Active' : 'Off'}</Text>
              <Text style={[styles.stockText, { color: stockColor }]}>· {stock} left</Text>
              {item.is_on_sale && (
                <View style={styles.saleBadge}><Text style={styles.saleBadgeText}>SALE</Text></View>
              )}
            </View>
          </View>
        </Pressable>
        <View style={styles.itemActions}>
          <Pressable style={styles.iconBtn} onPress={() => openQuickStock(item)} hitSlop={4}>
            <MaterialCommunityIcons name="cube-send" size={17} color="#10B981" />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => handleToggleActive(item)} hitSlop={4}>
            <MaterialCommunityIcons
              name={item.is_active ? 'eye-off-outline' : 'eye-outline'}
              size={17}
              color={colors.textSecondary}
            />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push(`/seller/products/edit?id=${item.id}` as any)}
            hitSlop={4}
          >
            <MaterialCommunityIcons name="pencil-outline" size={17} color={Brand.primary} />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => handleDelete(item)}
            disabled={deleting === item.id}
            hitSlop={4}
          >
            {deleting === item.id ? (
              <ActivityIndicator size="small" color={Brand.danger} />
            ) : (
              <MaterialCommunityIcons name="trash-can-outline" size={17} color={Brand.danger} />
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="My Products"
        subtitle={!loading && totalCount > 0 ? `${totalCount} product${totalCount === 1 ? '' : 's'}` : undefined}
        rightIcon="plus"
        onRightPress={() => router.push('/seller/products/add' as any)}
      />

      {/* ── Search bar ────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search name, SKU, or barcode..."
            placeholderTextColor={colors.textTertiary}
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
          />
          {searchInput ? (
            <Pressable onPress={clearSearch} hitSlop={8}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textTertiary} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          style={({ pressed }) => [styles.filterBtn, pressed && { opacity: 0.7 }]}
          onPress={() => setShowFilters(true)}
        >
          <MaterialCommunityIcons name="filter-variant" size={22} color={activeFilterCount > 0 ? Brand.primary : colors.text} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ── Active filter chips ───────────────────────────────── */}
      {activeFilterCount > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {search && (
            <View style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>"{search}"</Text>
              <Pressable onPress={clearSearch} hitSlop={6}>
                <MaterialCommunityIcons name="close" size={14} color={colors.text} />
              </Pressable>
            </View>
          )}
          {stockFilter !== 'all' && (
            <Pressable style={styles.chip} onPress={() => setStockFilter('all')}>
              <Text style={styles.chipText}>{STOCK_OPTIONS.find(s => s.value === stockFilter)?.label}</Text>
              <MaterialCommunityIcons name="close" size={14} color={colors.text} />
            </Pressable>
          )}
          {activeFilter !== 'all' && (
            <Pressable style={styles.chip} onPress={() => setActiveFilter('all')}>
              <Text style={styles.chipText}>{ACTIVE_OPTIONS.find(a => a.value === activeFilter)?.label}</Text>
              <MaterialCommunityIcons name="close" size={14} color={colors.text} />
            </Pressable>
          )}
          {categoryId && (
            <Pressable style={styles.chip} onPress={() => setCategoryId(null)}>
              <Text style={styles.chipText} numberOfLines={1}>{selectedCategory?.name || 'Category'}</Text>
              <MaterialCommunityIcons name="close" size={14} color={colors.text} />
            </Pressable>
          )}
          {brandId && (
            <Pressable style={styles.chip} onPress={() => setBrandId(null)}>
              <Text style={styles.chipText} numberOfLines={1}>{selectedBrand?.name || 'Brand'}</Text>
              <MaterialCommunityIcons name="close" size={14} color={colors.text} />
            </Pressable>
          )}
          <Pressable style={[styles.chip, styles.clearChip]} onPress={resetFilters}>
            <Text style={[styles.chipText, { color: Brand.danger }]}>Clear All</Text>
          </Pressable>
        </ScrollView>
      )}

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={() => load(1)}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="package-variant" size={56} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              {activeFilterCount > 0 ? 'No products match your filters' : 'No products yet'}
            </Text>
            <Text style={styles.emptySub}>
              {activeFilterCount > 0 ? 'Try adjusting your search or filters' : 'Add your first product to start selling'}
            </Text>
            {activeFilterCount > 0 ? (
              <Pressable style={styles.addBtn} onPress={resetFilters}>
                <MaterialCommunityIcons name="filter-remove-outline" size={20} color="#FFFFFF" />
                <Text style={styles.addBtnText}>Clear Filters</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.addBtn}
                onPress={() => router.push('/seller/products/add' as any)}
              >
                <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
                <Text style={styles.addBtnText}>Add Product</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(item) => `${item.id}`}
            renderItem={renderItem}
            style={styles.listCard}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
            maxToRenderPerBatch={12}
            windowSize={11}
            initialNumToRender={12}
            removeClippedSubviews={true}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator size="small" color={Brand.primary} style={{ paddingVertical: 14 }} />
              ) : hasMore ? null : products.length > 15 ? (
                <Text style={styles.endText}>All {totalCount} products loaded</Text>
              ) : null
            }
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(1)} colors={[Brand.primary]} tintColor={Brand.primary} />}
          />
        )}
      </View>

      {/* ── Filter modal ──────────────────────────────────────── */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.filterSheet}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filters</Text>
              <Pressable onPress={() => setShowFilters(false)} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.filterBody} showsVerticalScrollIndicator={false}>
              {/* Sort */}
              <Text style={styles.filterSectionLabel}>Sort By</Text>
              <View style={styles.filterOptions}>
                {SORT_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[styles.filterOption, sort === opt.value && styles.filterOptionActive]}
                    onPress={() => setSort(opt.value)}
                  >
                    <Text style={[styles.filterOptionText, sort === opt.value && styles.filterOptionTextActive]}>
                      {opt.label}
                    </Text>
                    {sort === opt.value && (
                      <MaterialCommunityIcons name="check" size={18} color={Brand.primary} />
                    )}
                  </Pressable>
                ))}
              </View>

              {/* Status */}
              <Text style={styles.filterSectionLabel}>Status</Text>
              <View style={styles.filterChipsRow}>
                {ACTIVE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[styles.filterChip, activeFilter === opt.value && styles.filterChipActive]}
                    onPress={() => setActiveFilter(opt.value)}
                  >
                    <Text style={[styles.filterChipText, activeFilter === opt.value && styles.filterChipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Stock */}
              <Text style={styles.filterSectionLabel}>Stock</Text>
              <View style={styles.filterChipsRow}>
                {STOCK_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[styles.filterChip, stockFilter === opt.value && styles.filterChipActive]}
                    onPress={() => setStockFilter(opt.value)}
                  >
                    <Text style={[styles.filterChipText, stockFilter === opt.value && styles.filterChipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Category */}
              <Text style={styles.filterSectionLabel}>Category</Text>
              <Pressable style={styles.dropdown} onPress={() => setShowCategoryModal(true)}>
                <Text style={[styles.dropdownText, !selectedCategory && styles.dropdownPlaceholder]} numberOfLines={1}>
                  {selectedCategory ? selectedCategory.name : 'All categories'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
              </Pressable>

              {/* Brand */}
              <Text style={styles.filterSectionLabel}>Brand</Text>
              <Pressable style={styles.dropdown} onPress={() => setShowBrandModal(true)}>
                <Text style={[styles.dropdownText, !selectedBrand && styles.dropdownPlaceholder]} numberOfLines={1}>
                  {selectedBrand ? selectedBrand.name : 'All brands'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
              </Pressable>
            </ScrollView>

            <View style={styles.filterFooter}>
              <Pressable style={[styles.filterFooterBtn, styles.resetBtn]} onPress={resetFilters}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </Pressable>
              <Pressable style={[styles.filterFooterBtn, styles.applyBtn]} onPress={() => setShowFilters(false)}>
                <Text style={styles.applyBtnText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Category modal ────────────────────────────────────── */}
      <Modal visible={showCategoryModal} transparent animationType="slide" onRequestClose={() => setShowCategoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Select Category</Text>
              <Pressable onPress={() => setShowCategoryModal(false)} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.filterBody}>
              <Pressable
                style={[styles.filterOption, !categoryId && styles.filterOptionActive]}
                onPress={() => { setCategoryId(null); setShowCategoryModal(false); }}
              >
                <Text style={[styles.filterOptionText, !categoryId && styles.filterOptionTextActive]}>All categories</Text>
                {!categoryId && <MaterialCommunityIcons name="check" size={18} color={Brand.primary} />}
              </Pressable>
              {categories.filter((c) => !c.parent).map((cat) => (
                <View key={`cat-${cat.id}`}>
                  <Pressable
                    style={[styles.filterOption, categoryId === cat.id && styles.filterOptionActive]}
                    onPress={() => { setCategoryId(cat.id); setShowCategoryModal(false); }}
                  >
                    <Text style={[styles.filterOptionText, categoryId === cat.id && styles.filterOptionTextActive]}>{cat.name}</Text>
                    {categoryId === cat.id && <MaterialCommunityIcons name="check" size={18} color={Brand.primary} />}
                  </Pressable>
                  {cat.children?.map((child) => (
                    <Pressable
                      key={`child-${child.id}`}
                      style={[styles.filterOption, { paddingLeft: 32 }, categoryId === child.id && styles.filterOptionActive]}
                      onPress={() => { setCategoryId(child.id); setShowCategoryModal(false); }}
                    >
                      <Text style={[styles.filterOptionText, categoryId === child.id && styles.filterOptionTextActive]}>↳ {child.name}</Text>
                      {categoryId === child.id && <MaterialCommunityIcons name="check" size={18} color={Brand.primary} />}
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Brand modal ───────────────────────────────────────── */}
      <Modal visible={showBrandModal} transparent animationType="slide" onRequestClose={() => setShowBrandModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Select Brand</Text>
              <Pressable onPress={() => setShowBrandModal(false)} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.filterBody}>
              <Pressable
                style={[styles.filterOption, !brandId && styles.filterOptionActive]}
                onPress={() => { setBrandId(null); setShowBrandModal(false); }}
              >
                <Text style={[styles.filterOptionText, !brandId && styles.filterOptionTextActive]}>All brands</Text>
                {!brandId && <MaterialCommunityIcons name="check" size={18} color={Brand.primary} />}
              </Pressable>
              {brands.map((br) => (
                <Pressable
                  key={`brand-${br.id}`}
                  style={[styles.filterOption, brandId === br.id && styles.filterOptionActive]}
                  onPress={() => { setBrandId(br.id); setShowBrandModal(false); }}
                >
                  <Text style={[styles.filterOptionText, brandId === br.id && styles.filterOptionTextActive]}>{br.name}</Text>
                  {brandId === br.id && <MaterialCommunityIcons name="check" size={18} color={Brand.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Quick Stock Modal ─────────────────────────────────── */}
      <Modal visible={!!stockModalItem} transparent animationType="fade" onRequestClose={() => setStockModalItem(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerSheet, { maxHeight: 320, padding: 20 }]}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Quick Stock Adjustment</Text>
              <Pressable onPress={() => setStockModalItem(null)} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }} numberOfLines={1}>
              {stockModalItem?.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
              <Pressable
                style={{ width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}
                onPress={() => setQuickStockVal(String(Math.max(0, (parseInt(quickStockVal, 10) || 0) - 1)))}
              >
                <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>-</Text>
              </Pressable>
              <TextInput
                style={{ width: 100, height: 48, borderWidth: 1.5, borderColor: Brand.primary, borderRadius: 10, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.text }}
                keyboardType="numeric"
                value={quickStockVal}
                onChangeText={setQuickStockVal}
              />
              <Pressable
                style={{ width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}
                onPress={() => setQuickStockVal(String((parseInt(quickStockVal, 10) || 0) + 1))}
              >
                <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>+</Text>
              </Pressable>
            </View>
            <Pressable
              style={{ backgroundColor: Brand.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', opacity: updatingStock ? 0.6 : 1 }}
              onPress={handleSaveQuickStock}
              disabled={updatingStock}
            >
              {updatingStock ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Update Stock</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },

  // ── Search ──────────────────────────────────────────────────
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two - 2,
    backgroundColor: c.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.two + 2,
    borderWidth: 1,
    borderColor: c.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: c.text, paddingVertical: 0 },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: Brand.primary,
    minWidth: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },

  // ── Chips ───────────────────────────────────────────────────
  chipsRow: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two - 2, gap: Spacing.two - 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: c.text, maxWidth: 120 },
  clearChip: { borderColor: 'transparent', backgroundColor: 'transparent' },

  // ── List — single card, dense rows ──────────────────────────
  listCard: { flex: 1 },
  list: {
    margin: 10, borderRadius: 14, overflow: 'hidden',
    backgroundColor: c.surface,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 8, gap: 4,
  },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  productImage: { width: 44, height: 44, borderRadius: 8 },
  productImageFallback: { width: 44, height: 44, borderRadius: 8, backgroundColor: c.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  productInfo: { flex: 1, gap: 2, justifyContent: 'center' },
  productName: { fontSize: 13, fontWeight: '700', color: c.text },
  productPrice: { fontSize: 12, fontWeight: '800', color: Brand.primary },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  productStatus: { fontSize: 11, color: c.textSecondary, fontWeight: '600' },
  stockText: { fontSize: 11, fontWeight: '600' },
  saleBadge: {
    backgroundColor: Brand.danger,
    paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3,
  },
  saleBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '800' },
  itemActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 6 },
  rowDivider: { height: 1, backgroundColor: c.borderLight, marginLeft: 62 },
  endText: { textAlign: 'center', fontSize: 11, color: c.textTertiary, paddingVertical: 12, backgroundColor: 'transparent' },

  // ── Empty/error ─────────────────────────────────────────────
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { marginTop: 12, fontSize: 16, fontWeight: '700', color: c.text },
  emptySub: { marginTop: 4, fontSize: 14, color: c.textSecondary, textAlign: 'center' },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 12, marginTop: 20, elevation: 3,
    shadowColor: Brand.primary, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  // ── Filter modal ────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  filterSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  pickerSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three + Spacing.half,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  filterTitle: { fontSize: 17, fontWeight: '700', color: c.text },
  filterBody: { padding: Spacing.three },
  filterSectionLabel: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: Spacing.two, marginTop: Spacing.two },
  filterOptions: { gap: 2 },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two + Spacing.half,
    paddingHorizontal: Spacing.three - Spacing.half,
    borderRadius: 10,
  },
  filterOptionActive: { backgroundColor: c.surfaceAlt },
  filterOptionText: { fontSize: 15, color: c.textSecondary },
  filterOptionTextActive: { color: Brand.primary, fontWeight: '700' },

  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two - 2, marginBottom: Spacing.two },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceAlt,
  },
  filterChipActive: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  filterChipText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  filterChipTextActive: { color: '#FFFFFF' },

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.three - Spacing.half,
    paddingVertical: Spacing.two + Spacing.half,
    backgroundColor: c.surfaceAlt,
    marginBottom: Spacing.two,
  },
  dropdownText: { fontSize: 15, color: c.text, flex: 1 },
  dropdownPlaceholder: { color: c.textTertiary },

  filterFooter: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: c.borderLight,
  },
  filterFooterBtn: { flex: 1, paddingVertical: Spacing.three - 2, borderRadius: 12, alignItems: 'center' },
  resetBtn: { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
  resetBtnText: { color: c.textSecondary, fontSize: 15, fontWeight: '700' },
  applyBtn: { backgroundColor: Brand.primary },
  applyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
