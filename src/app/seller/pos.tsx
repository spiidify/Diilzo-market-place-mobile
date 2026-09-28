import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Keyboard,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientHeader } from '@/components/GradientHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import {
    createPOSSale,
    getMyProducts,
    getPOSDashboard,
    getPOSSales,
    type POSDashboardData,
    type POSSalePayload,
    type POSSaleRecord,
    type POSSalesSummary,
} from '@/services/seller';

type HistoryRange = 'all' | 'today' | '7d' | '30d';
type HistoryMethod = '' | 'cash' | 'mtn_momo' | 'airtel_money' | 'card' | 'credit' | 'mixed';

const HISTORY_RANGES: { key: HistoryRange; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
];

const HISTORY_METHODS: { key: HistoryMethod; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'cash', label: 'Cash' },
  { key: 'mtn_momo', label: 'MTN MoMo' },
  { key: 'airtel_money', label: 'Airtel' },
  { key: 'card', label: 'Card' },
  { key: 'credit', label: 'Credit' },
  { key: 'mixed', label: 'Mixed' },
];

const METHOD_COLORS: Record<string, string> = {
  cash: '#16A34A',
  mtn_momo: '#CA8A04',
  airtel_money: '#DC2626',
  card: '#2563EB',
  credit: '#7C3AED',
  mixed: '#A21CAF',
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface CartItem {
  id: number;
  name: string;
  price: number;
  stock: number;
  quantity: number;
}

export default function SellerPOSScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Inside a Modal on edge-to-edge Android, safe-area insets report 0 —
  // fall back to the real status bar height so the header isn't covered.
  const modalTopInset = Math.max(
    insets?.top ?? 0,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0
  );

  // Mode: 'register' | 'history'
  const [activeTab, setActiveTab] = useState<'register' | 'history'>('register');

  // Products
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productPage, setProductPage] = useState(1);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState('0');
  const [discountMode, setDiscountMode] = useState<'ugx' | 'pct'>('ugx');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mtn_momo' | 'airtel_money' | 'card'>('cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [submittingSale, setSubmittingSale] = useState(false);

  // Keyboard handling inside the review sheet — KeyboardAvoidingView can't
  // be used inside a Modal (mis-measures, collapses children), so we pad the
  // scroll content by the keyboard height and auto-scroll to keep the
  // focused field visible.
  const modalScrollRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => modalScrollRef.current?.scrollToEnd({ animated: true }), 80);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Completed Receipt Modal
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Stats & History
  const [stats, setStats] = useState<POSDashboardData | null>(null);
  const [salesHistory, setSalesHistory] = useState<POSSaleRecord[]>([]);
  const [salesSummary, setSalesSummary] = useState<POSSalesSummary | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // History filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyMethod, setHistoryMethod] = useState<HistoryMethod>('');
  const [historyRange, setHistoryRange] = useState<HistoryRange>('all');

  // Load products with pagination
  const loadProducts = useCallback(async (page = 1, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingProducts(true);
      }
      const res = await getMyProducts({
        search: search.trim() || undefined,
        page,
        page_size: 20,
      });
      const list = Array.isArray(res) ? res : (res as any)?.results || [];
      const hasNext = Boolean((res as any)?.next);

      if (append) {
        setProducts((prev) => [...prev, ...list]);
      } else {
        setProducts(list);
      }
      setProductPage(page);
      setHasMoreProducts(hasNext);
    } catch {
      // Non-critical error
    } finally {
      setLoadingProducts(false);
      setLoadingMore(false);
    }
  }, [search]);

  // Load stats and history
  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const filters: Record<string, string> = {};
      if (historySearch.trim()) filters.q = historySearch.trim();
      if (historyMethod) filters.method = historyMethod;

      const today = new Date();
      if (historyRange === 'today') {
        filters.date_from = isoDate(today);
        filters.date_to = isoDate(today);
      } else if (historyRange === '7d') {
        const from = new Date(today);
        from.setDate(from.getDate() - 6);
        filters.date_from = isoDate(from);
        filters.date_to = isoDate(today);
      } else if (historyRange === '30d') {
        const from = new Date(today);
        from.setDate(from.getDate() - 29);
        filters.date_from = isoDate(from);
        filters.date_to = isoDate(today);
      }

      const [statsData, salesData] = await Promise.all([
        getPOSDashboard().catch(() => null),
        getPOSSales(filters).catch(() => ({ results: [], summary: undefined })),
      ]);
      if (statsData) setStats(statsData);
      setSalesHistory(salesData.results || []);
      setSalesSummary(salesData.summary || null);
    } finally {
      setRefreshing(false);
    }
  }, [historySearch, historyMethod, historyRange]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cart calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    const d = parseFloat(discount);
    if (isNaN(d) || d <= 0 || subtotal <= 0) return 0;
    if (discountMode === 'pct') {
      return Math.min(subtotal, Math.round((subtotal * d) / 100));
    }
    return Math.min(subtotal, d);
  }, [discount, discountMode, subtotal]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const tenderedNum = useMemo(() => {
    const t = parseFloat(amountTendered);
    return isNaN(t) ? 0 : t;
  }, [amountTendered]);

  const changeDue = useMemo(() => {
    if (paymentMethod !== 'cash') return 0;
    return Math.max(0, tenderedNum - grandTotal);
  }, [paymentMethod, tenderedNum, grandTotal]);

  const totalCartCount = useMemo(() => {
    return cart.reduce((cnt, item) => cnt + item.quantity, 0);
  }, [cart]);

  const cartQtyById = useMemo(() => {
    const map = new Map<number, number>();
    cart.forEach((i) => map.set(i.id, i.quantity));
    return map;
  }, [cart]);

  // Cart actions
  const addToCart = (product: any) => {
    const pPrice = Number(product.final_price || product.price || 0);
    const pStock = Number(product.stock_quantity || 0);

    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === product.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx].quantity += 1;
        return next;
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: pPrice,
          stock: pStock,
          quantity: 1,
        },
      ];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeItem = (id: number) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    Alert.alert('Clear Cart', 'Remove all items from current counter order?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setCart([]) },
    ]);
  };

  // Quick cash chips
  const handleQuickCash = (type: 'exact' | number) => {
    if (type === 'exact') {
      setAmountTendered(String(grandTotal));
    } else {
      const cur = parseFloat(amountTendered) || 0;
      setAmountTendered(String(cur + type));
    }
  };

  // Complete POS sale
  const handleCompleteSale = async () => {
    if (cart.length === 0) return;

    if (paymentMethod === 'cash' && tenderedNum > 0 && tenderedNum < grandTotal) {
      Alert.alert('Insufficient Cash', 'Amount tendered is less than the Grand Total.');
      return;
    }

    try {
      setSubmittingSale(true);
      const payload: POSSalePayload = {
        customer_name: customerName.trim() || 'Walk-in Customer',
        customer_phone: customerPhone.trim() || undefined,
        payment_method: paymentMethod,
        discount: discountAmount,
        amount_paid: paymentMethod === 'cash' ? (tenderedNum || grandTotal) : grandTotal,
        items: cart.map((i) => ({
          product_id: i.id,
          name: i.name,
          quantity: i.quantity,
          unit_price: i.price,
        })),
      };

      const res = await createPOSSale(payload);
      setCompletedSale({
        ...res,
        items: cart,
        total: grandTotal,
        changeDue: paymentMethod === 'cash' ? changeDue : 0,
        paymentMethod,
        customerName: customerName || 'Walk-in Customer',
      });

      // Clear cart & close checkout sheet
      setCart([]);
      setAmountTendered('');
      setDiscount('0');
      setShowCartModal(false);
      setShowReceiptModal(true);

      // Refresh sales data
      loadData();
    } catch (err: any) {
      Alert.alert('Sale Error', err?.message || 'Could not complete sale.');
    } finally {
      setSubmittingSale(false);
    }
  };

  return (
    <View style={styles.container}>
      <GradientHeader
        title="Point of Sale"
        subtitle="Counter checkout & in-store inventory"
        onBack={() => router.back()}
        rightIcon="cart-outline"
        rightBadge={totalCartCount}
        onRightPress={() => {
          if (cart.length > 0) setShowCartModal(true);
        }}
      />

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabBtn, activeTab === 'register' && styles.tabBtnActive]}
          onPress={() => setActiveTab('register')}
        >
          <MaterialCommunityIcons
            name="cash-register"
            size={18}
            color={activeTab === 'register' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text style={[styles.tabBtnText, activeTab === 'register' && styles.tabBtnTextActive]}>
            Register
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
          onPress={() => setActiveTab('history')}
        >
          <MaterialCommunityIcons
            name="receipt"
            size={18}
            color={activeTab === 'history' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>
            Sales History
          </Text>
        </Pressable>
      </View>

      {/* Stats Summary Strip */}
      <View style={styles.statsStrip}>
        <MaterialCommunityIcons name="cash-multiple" size={15} color={Brand.primary} />
        <Text style={styles.statsText}>
          Today{'  '}
          <Text style={styles.statsValue}>
            UGX {Number(stats?.today_sales_total || 0).toLocaleString()}
          </Text>
        </Text>
        <View style={styles.statDivider} />
        <MaterialCommunityIcons name="receipt-text-outline" size={15} color={colors.textSecondary} />
        <Text style={styles.statsText}>
          <Text style={styles.statsValue}>{stats?.today_sales_count || 0}</Text> sales
        </Text>
      </View>

      {/* Main Content Area */}
      {activeTab === 'register' ? (
        <View style={styles.registerContainer}>
          {/* Barcode / Search Box */}
          <View style={styles.searchBar}>
            <MaterialCommunityIcons name="barcode-scan" size={20} color={Brand.primary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search product by name, SKU, or barcode..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* Product Catalog Grid */}
          {loadingProducts ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={Brand.primary} />
              <Text style={styles.loadingText}>Loading products...</Text>
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(item) => String(item.id)}
              numColumns={3}
              columnWrapperStyle={styles.columnWrapper}
              contentContainerStyle={styles.productsList}
              renderItem={({ item }) => {
                const isOutOfStock = item.stock_quantity <= 0;
                const inCartQty = cartQtyById.get(item.id) || 0;
                return (
                  <Pressable
                    style={[
                      styles.productCard,
                      isOutOfStock && styles.productCardOut,
                      inCartQty > 0 && styles.productCardInCart,
                    ]}
                    onPress={() => addToCart(item)}
                  >
                    <View style={styles.productImgWrap}>
                      {item.primary_image_url ? (
                        <Image source={{ uri: item.primary_image_url }} style={styles.productImg} />
                      ) : (
                        <View style={styles.noImgBox}>
                          <MaterialCommunityIcons name="package-variant" size={26} color="#D1D5DB" />
                        </View>
                      )}
                      {inCartQty > 0 && (
                        <View style={styles.inCartBadge}>
                          <MaterialCommunityIcons name="cart" size={10} color="#FFFFFF" />
                          <Text style={styles.inCartBadgeText}>{inCartQty}</Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.stockBadge,
                          isOutOfStock ? styles.stockBadgeOut : styles.stockBadgeIn,
                        ]}
                      >
                        <Text style={styles.stockBadgeText}>
                          {isOutOfStock ? 'Out of stock' : `${item.stock_quantity} left`}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.productPrice}>
                      UGX {Number(item.final_price || item.price || 0).toLocaleString()}
                    </Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="package-variant-closed" size={48} color={colors.border} />
                  <Text style={styles.emptyTitle}>No matching products</Text>
                  <Text style={styles.emptySubtitle}>Try searching another keyword or barcode</Text>
                </View>
              }
              onEndReached={() => {
                if (!loadingProducts && !loadingMore && hasMoreProducts) {
                  loadProducts(productPage + 1, true);
                }
              }}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                loadingMore ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={Brand.primary} />
                  </View>
                ) : null
              }
            />
          )}

          {/* Bottom Cart Floating Bar */}
          {cart.length > 0 && (
            <View style={styles.cartBar}>
              <View style={styles.cartBarLeft}>
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeNum}>{totalCartCount}</Text>
                </View>
                <View>
                  <Text style={styles.cartBarLabel}>Current Order</Text>
                  <Text style={styles.cartBarTotal}>UGX {grandTotal.toLocaleString()}</Text>
                </View>
              </View>
              <Pressable style={styles.cartBarBtn} onPress={() => setShowCartModal(true)}>
                <Text style={styles.cartBarBtnText}>Review & Pay</Text>
                <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        /* History Tab */
        <View style={{ flex: 1 }}>
          {/* Search */}
          <View style={[styles.searchBar, { marginHorizontal: 12 }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={Brand.primary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search sale #, customer, phone..."
              placeholderTextColor={colors.textSecondary}
              value={historySearch}
              onChangeText={setHistorySearch}
              onSubmitEditing={loadData}
              returnKeyType="search"
            />
            {historySearch.length > 0 && (
              <Pressable onPress={() => setHistorySearch('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* Range pills */}
          <View style={styles.filterPillRow}>
            {HISTORY_RANGES.map((r) => (
              <Pressable
                key={r.key}
                style={[styles.filterPill, historyRange === r.key && styles.filterPillActive]}
                onPress={() => setHistoryRange(r.key)}
              >
                <Text style={[styles.filterPillText, historyRange === r.key && styles.filterPillTextActive]}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Method pills */}
          <View style={[styles.filterPillRow, { marginTop: 0, marginBottom: 4 }]}>
            {HISTORY_METHODS.map((m) => (
              <Pressable
                key={m.key}
                style={[
                  styles.filterPill,
                  historyMethod === m.key && styles.filterPillActive,
                  historyMethod === m.key && m.key !== '' && { backgroundColor: METHOD_COLORS[m.key] },
                ]}
                onPress={() => setHistoryMethod(m.key)}
              >
                <Text style={[styles.filterPillText, historyMethod === m.key && styles.filterPillTextActive]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Filtered summary */}
          {salesSummary && (
            <View style={styles.historySummary}>
              <Text style={styles.historySummaryText}>
                <Text style={{ fontWeight: '800', color: colors.text }}>{salesSummary.count}</Text> sale{salesSummary.count === 1 ? '' : 's'}
                {'  ·  '}Total <Text style={{ fontWeight: '800', color: Brand.primary }}>UGX {Number(salesSummary.total).toLocaleString()}</Text>
                {salesSummary.count > 0 && (
                  <>{'  ·  '}Avg <Text style={{ fontWeight: '800', color: colors.text }}>UGX {Number(salesSummary.avg).toLocaleString()}</Text></>
                )}
              </Text>
            </View>
          )}

          <FlatList
            data={salesHistory}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.historyList}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
            renderItem={({ item }) => {
              const mColor = METHOD_COLORS[item.payment_method] || colors.textSecondary;
              return (
                <View style={styles.historyCard}>
                  <View style={styles.historyCardHead}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.statusDot, { backgroundColor: item.completed ? Brand.primary : Brand.rating }]} />
                        <Text style={styles.historySaleNum}>{item.sale_number}</Text>
                      </View>
                      <Text style={styles.historyCustomer}>{item.customer_name || 'Walk-in Customer'}</Text>
                      {item.customer_phone ? (
                        <Text style={styles.historyMeta}>{item.customer_phone}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.historyTotal}>UGX {Number(item.total).toLocaleString()}</Text>
                  </View>
                  <View style={styles.historyCardFoot}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyDate}>
                        {new Date(item.sale_date).toLocaleDateString()} • {new Date(item.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      {(item.cashier || item.register) ? (
                        <Text style={styles.historyMeta} numberOfLines={1}>
                          {[item.cashier, item.register].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.historyMeta}>{item.items_count} item{item.items_count === 1 ? '' : 's'}</Text>
                      <View style={[styles.methodBadge, { backgroundColor: mColor + '18' }]}>
                        <Text style={[styles.methodBadgeText, { color: mColor }]}>{item.payment_method.replace(/_/g, ' ').toUpperCase()}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="receipt" size={48} color={colors.border} />
                <Text style={styles.emptyTitle}>
                  {historySearch || historyMethod || historyRange !== 'all' ? 'No matching sales' : 'No POS sales yet'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {historySearch || historyMethod || historyRange !== 'all'
                    ? 'Try adjusting your filters'
                    : 'In-store counter sales will appear here'}
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Cart & Checkout Modal Sheet */}
      <Modal
        visible={showCartModal}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        onRequestClose={() => setShowCartModal(false)}
      >
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={[Brand.dark, Brand.accent, Brand.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={{ paddingTop: modalTopInset }}>
              <View style={styles.modalHeaderBar}>
                <Pressable
                  onPress={() => setShowCartModal(false)}
                  hitSlop={12}
                  style={styles.modalHeaderBtn}
                >
                  <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
                </Pressable>
                <View style={styles.modalHeaderTitleWrap}>
                  <Text style={styles.modalHeaderTitle} numberOfLines={1}>Review & Pay</Text>
                  <Text style={styles.modalHeaderSub} numberOfLines={1}>
                    UGX {grandTotal.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.modalHeaderCartWrap}>
                  <MaterialCommunityIcons name="cart" size={24} color="#FFFFFF" />
                  {totalCartCount > 0 && (
                    <View style={styles.modalHeaderCartBadge}>
                      <Text style={styles.modalHeaderCartBadgeText}>
                        {totalCartCount > 99 ? '99+' : totalCartCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Pressable onPress={clearCart} hitSlop={12} style={styles.modalHeaderBtn}>
                  <MaterialCommunityIcons name="trash-can-outline" size={22} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          </LinearGradient>

          <ScrollView
            ref={modalScrollRef}
            style={styles.modalScroll}
            contentContainerStyle={[
              styles.modalScrollContent,
              { paddingBottom: 16 + keyboardHeight },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* Customer Inputs */}
            <View style={styles.modalSection}>
              <Text style={styles.sectionTitle}>Customer Details</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Customer Name (optional)"
                placeholderTextColor={colors.textSecondary}
                value={customerName}
                onChangeText={setCustomerName}
              />
              <TextInput
                style={styles.inputField}
                placeholder="Customer Phone (optional)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
                value={customerPhone}
                onChangeText={setCustomerPhone}
              />
            </View>

            {/* Cart Items List */}
            <View style={styles.modalSection}>
              <Text style={styles.sectionTitle}>Items ({totalCartCount})</Text>
              {cart.map((item) => (
                <View key={item.id} style={styles.cartRow}>
                  <View style={styles.cartRowInfo}>
                    <Text style={styles.cartRowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.cartRowUnit}>UGX {item.price.toLocaleString()} each</Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <Pressable
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(item.id, -1)}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </Pressable>
                    <Text style={styles.qtyValue}>{item.quantity}</Text>
                    <Pressable
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(item.id, 1)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.cartRowTotal}>
                    UGX {(item.price * item.quantity).toLocaleString()}
                  </Text>
                  <Pressable onPress={() => removeItem(item.id)} style={styles.removeBtn}>
                    <MaterialCommunityIcons name="close" size={18} color={Brand.danger} />
                  </Pressable>
                </View>
              ))}
            </View>

            {/* Order Summary & Discount */}
            <View style={styles.modalSection}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryVal}>UGX {subtotal.toLocaleString()}</Text>
              </View>

              {/* Modern Discount Module */}
              <View style={styles.discountCard}>
                <View style={styles.discountTop}>
                  <View style={styles.discountTitleWrap}>
                    <MaterialCommunityIcons name="tag-outline" size={15} color={Brand.primary} />
                    <Text style={styles.discountTitle}>Discount</Text>
                  </View>
                  <View style={styles.modeToggle}>
                    <Pressable
                      style={[styles.modeBtn, discountMode === 'ugx' && styles.modeBtnActive]}
                      onPress={() => setDiscountMode('ugx')}
                    >
                      <Text style={[styles.modeBtnText, discountMode === 'ugx' && styles.modeBtnTextActive]}>
                        UGX
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.modeBtn, discountMode === 'pct' && styles.modeBtnActive]}
                      onPress={() => setDiscountMode('pct')}
                    >
                      <Text style={[styles.modeBtnText, discountMode === 'pct' && styles.modeBtnTextActive]}>
                        %
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.discountInputWrap}>
                  <Text style={styles.discountPrefix}>{discountMode === 'ugx' ? 'UGX' : '%'}</Text>
                  <TextInput
                    style={styles.discountInputField}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    value={discount}
                    onChangeText={setDiscount}
                  />
                  {discountAmount > 0 && (
                    <View style={styles.savedBadge}>
                      <Text style={styles.savedBadgeText}>-UGX {discountAmount.toLocaleString()}</Text>
                    </View>
                  )}
                </View>

                {/* Preset Chips */}
                <View style={styles.presetChips}>
                  {[0, 5, 10, 15, 20].map((pct) => (
                    <Pressable
                      key={pct}
                      style={[
                        styles.presetChip,
                        discountMode === 'pct' && discount === String(pct) && styles.presetChipActive,
                      ]}
                      onPress={() => {
                        if (pct === 0) {
                          setDiscount('0');
                        } else {
                          setDiscountMode('pct');
                          setDiscount(String(pct));
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          discountMode === 'pct' && discount === String(pct) && styles.presetChipTextActive,
                        ]}
                      >
                        {pct === 0 ? 'None' : `${pct}%`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={[styles.summaryRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>Grand Total</Text>
                <Text style={styles.grandTotalVal}>UGX {grandTotal.toLocaleString()}</Text>
              </View>
            </View>

            {/* Payment Method */}
            <View style={styles.modalSection}>
              <Text style={styles.sectionTitle}>Payment Method</Text>
              <View style={styles.pmGrid}>
                {(['cash', 'mtn_momo', 'airtel_money', 'card'] as const).map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.pmBtn, paymentMethod === m && styles.pmBtnActive]}
                    onPress={() => setPaymentMethod(m)}
                  >
                    <MaterialCommunityIcons
                      name={
                        m === 'cash'
                          ? 'cash'
                          : m === 'card'
                          ? 'credit-card-outline'
                          : 'cellphone'
                      }
                      size={20}
                      color={paymentMethod === m ? Brand.primary : colors.textSecondary}
                    />
                    <Text style={[styles.pmBtnText, paymentMethod === m && styles.pmBtnTextActive]}>
                      {m === 'cash'
                        ? 'Cash'
                        : m === 'mtn_momo'
                        ? 'MTN MoMo'
                        : m === 'airtel_money'
                        ? 'Airtel Money'
                        : 'Card'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Cash Tendered & Quick Chips */}
            {paymentMethod === 'cash' && (
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Cash Received</Text>
                <TextInput
                  style={styles.tenderedInput}
                  placeholder="Amount Received"
                  keyboardType="numeric"
                  value={amountTendered}
                  onChangeText={setAmountTendered}
                />
                <View style={styles.quickCashGrid}>
                  <Pressable style={styles.cashChip} onPress={() => handleQuickCash('exact')}>
                    <Text style={styles.cashChipText}>Exact</Text>
                  </Pressable>
                  <Pressable style={styles.cashChip} onPress={() => handleQuickCash(5000)}>
                    <Text style={styles.cashChipText}>+5,000</Text>
                  </Pressable>
                  <Pressable style={styles.cashChip} onPress={() => handleQuickCash(10000)}>
                    <Text style={styles.cashChipText}>+10,000</Text>
                  </Pressable>
                  <Pressable style={styles.cashChip} onPress={() => handleQuickCash(50000)}>
                    <Text style={styles.cashChipText}>+50,000</Text>
                  </Pressable>
                </View>
                <View style={styles.changeDueBox}>
                  <Text style={styles.changeDueLabel}>Change Due:</Text>
                  <Text style={styles.changeDueVal}>UGX {changeDue.toLocaleString()}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Complete Button Footer */}
          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets?.bottom ?? 0, 10) }]}>
            <Pressable
              style={[styles.completeBtn, submittingSale && styles.completeBtnDisabled]}
              onPress={handleCompleteSale}
              disabled={submittingSale}
            >
              {submittingSale ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check-circle-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.completeBtnText}>
                    Complete Sale • UGX {grandTotal.toLocaleString()}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Printable / View Receipt Modal */}
      <Modal
        visible={showReceiptModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowReceiptModal(false)}
      >
        <View style={styles.receiptOverlay}>
          <View style={styles.receiptContent}>
            <MaterialCommunityIcons name="check-circle" size={48} color={Brand.primary} />
            <Text style={styles.receiptSuccessTitle}>Sale Completed!</Text>
            <Text style={styles.receiptNumber}>{completedSale?.sale_number || 'POS Sale'}</Text>

            <View style={styles.receiptDivider} />
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Customer:</Text>
              <Text style={styles.receiptVal}>{completedSale?.customerName}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Payment:</Text>
              <Text style={styles.receiptVal}>{completedSale?.paymentMethod?.toUpperCase()}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Total Paid:</Text>
              <Text style={[styles.receiptVal, { color: Brand.primary, fontWeight: '800' }]}>
                UGX {Number(completedSale?.total || 0).toLocaleString()}
              </Text>
            </View>
            {completedSale?.changeDue > 0 && (
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Change Given:</Text>
                <Text style={styles.receiptVal}>UGX {completedSale?.changeDue?.toLocaleString()}</Text>
              </View>
            )}
            <View style={styles.receiptDivider} />

            <Pressable
              style={styles.newSaleBtn}
              onPress={() => setShowReceiptModal(false)}
            >
              <Text style={styles.newSaleBtnText}>Next Customer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.surfaceAlt,
      gap: 6,
    },
    tabBtnActive: {
      backgroundColor: Brand.primary,
    },
    tabBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabBtnTextActive: {
      color: '#FFFFFF',
    },
    statsStrip: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      paddingVertical: 7,
      paddingHorizontal: 12,
      marginHorizontal: 12,
      marginTop: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    statsText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    statsValue: {
      fontSize: 12.5,
      fontWeight: '800',
      color: colors.text,
    },
    statDivider: {
      width: 1,
      height: 14,
      backgroundColor: colors.border,
    },
    registerContainer: {
      flex: 1,
      paddingHorizontal: 8,
      paddingTop: 8,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 13.5,
      color: colors.text,
      paddingVertical: 0,
    },
    columnWrapper: {
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    productsList: {
      paddingBottom: 80,
    },
    productCard: {
      width: '32.4%',
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 7,
      borderWidth: 1,
      borderColor: colors.border,
    },
    productCardOut: {
      opacity: 0.5,
    },
    productCardInCart: {
      borderColor: Brand.primary,
      borderWidth: 1.5,
      backgroundColor: 'rgba(5, 150, 105, 0.07)',
    },
    inCartBadge: {
      position: 'absolute',
      top: 3,
      right: 3,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: Brand.primary,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 8,
    },
    inCartBadgeText: {
      fontSize: 9.5,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    productImgWrap: {
      position: 'relative',
      width: '100%',
      aspectRatio: 1,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: colors.surfaceAlt,
      marginBottom: 6,
    },
    productImg: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    noImgBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stockBadge: {
      position: 'absolute',
      bottom: 3,
      left: 3,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
    },
    stockBadgeIn: {
      backgroundColor: 'rgba(0,0,0,0.65)',
    },
    stockBadgeOut: {
      backgroundColor: Brand.danger,
    },
    stockBadgeText: {
      fontSize: 8.5,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    productName: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 14,
      marginBottom: 3,
    },
    productPrice: {
      fontSize: 12,
      fontWeight: '800',
      color: Brand.primary,
    },
    centerBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 8,
      fontSize: 13,
      color: colors.textSecondary,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginTop: 12,
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
    },
    cartBar: {
      position: 'absolute',
      bottom: 12,
      left: 12,
      right: 12,
      backgroundColor: '#1E293B',
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 6,
    },
    cartBarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    cartBadge: {
      backgroundColor: Brand.primary,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cartBadgeNum: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 13,
    },
    cartBarLabel: {
      color: '#94A3B8',
      fontSize: 11,
      fontWeight: '600',
    },
    cartBarTotal: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
    cartBarBtn: {
      backgroundColor: Brand.primary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    cartBarBtnText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 13,
    },
    historyList: {
      padding: 12,
      paddingTop: 2,
      paddingBottom: 40,
    },
    filterPillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      paddingHorizontal: 12,
      marginTop: 8,
      marginBottom: 2,
    },
    filterPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterPillActive: {
      backgroundColor: '#1E293B',
      borderColor: '#1E293B',
    },
    filterPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    filterPillTextActive: {
      color: '#FFFFFF',
    },
    historySummary: {
      marginHorizontal: 12,
      marginTop: 6,
      marginBottom: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    historySummaryText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    historyMeta: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    historyCard: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    historyCardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    historySaleNum: {
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.text,
    },
    historyCustomer: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    historyTotal: {
      fontSize: 15,
      fontWeight: '800',
      color: Brand.primary,
    },
    historyCardFoot: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    historyDate: {
      fontSize: 11.5,
      color: colors.textSecondary,
    },
    methodBadge: {
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
    },
    methodBadgeText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: colors.text,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeaderBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    modalHeaderBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalHeaderTitleWrap: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    modalHeaderTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },
    modalHeaderSub: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 1,
      fontWeight: '500',
    },
    modalHeaderCartWrap: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalHeaderCartBadge: {
      position: 'absolute',
      top: 2,
      right: 0,
      backgroundColor: '#FFFFFF',
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalHeaderCartBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: Brand.primary,
    },
    modalScroll: {
      flex: 1,
    },
    modalScrollContent: {
      padding: 16,
    },
    modalSection: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    inputField: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 13,
      color: colors.text,
      marginBottom: 8,
    },
    cartRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cartRowInfo: {
      flex: 1,
    },
    cartRowName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    cartRowUnit: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    qtyControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginHorizontal: 8,
    },
    qtyBtn: {
      width: 26,
      height: 26,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    qtyBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    qtyValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      minWidth: 16,
      textAlign: 'center',
    },
    cartRowTotal: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      minWidth: 75,
      textAlign: 'right',
    },
    removeBtn: {
      padding: 6,
      marginLeft: 4,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    summaryLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    summaryVal: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    discountCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: 12,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    discountTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    discountTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    discountTitle: {
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.text,
    },
    modeToggle: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 6,
      padding: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modeBtn: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
    },
    modeBtnActive: {
      backgroundColor: Brand.primary,
    },
    modeBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    modeBtnTextActive: {
      color: '#FFFFFF',
    },
    discountInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      marginBottom: 8,
    },
    discountPrefix: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      marginRight: 6,
    },
    discountInputField: {
      flex: 1,
      paddingVertical: 8,
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    savedBadge: {
      backgroundColor: '#DCFCE7',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    savedBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#15803D',
    },
    presetChips: {
      flexDirection: 'row',
      gap: 6,
    },
    presetChip: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    presetChipActive: {
      backgroundColor: 'rgba(5, 150, 105, 0.12)',
      borderColor: Brand.primary,
    },
    presetChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    presetChipTextActive: {
      color: Brand.primary,
      fontWeight: '800',
    },
    grandTotalRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
      marginTop: 4,
    },
    grandTotalLabel: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    grandTotalVal: {
      fontSize: 17,
      fontWeight: '900',
      color: Brand.primary,
    },
    pmGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    pmBtn: {
      flex: 1,
      minWidth: '45%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    pmBtnActive: {
      borderColor: Brand.primary,
      backgroundColor: 'rgba(5, 150, 105, 0.08)',
    },
    pmBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    pmBtnTextActive: {
      color: Brand.primary,
      fontWeight: '700',
    },
    tenderedInput: {
      borderWidth: 1.5,
      borderColor: Brand.primary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    quickCashGrid: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
      marginBottom: 10,
    },
    cashChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cashChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    changeDueBox: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#DCFCE7',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    changeDueLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: '#15803D',
    },
    changeDueVal: {
      fontSize: 16,
      fontWeight: '900',
      color: '#15803D',
    },
    modalFooter: {
      paddingHorizontal: 16,
      paddingTop: 10,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    completeBtn: {
      backgroundColor: Brand.primary,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
    },
    completeBtnDisabled: {
      opacity: 0.6,
    },
    completeBtnText: {
      fontSize: 15,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    receiptOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    receiptContent: {
      width: '100%',
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
    },
    receiptSuccessTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      marginTop: 8,
    },
    receiptNumber: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    receiptDivider: {
      width: '100%',
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    receiptRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      paddingVertical: 4,
    },
    receiptLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    receiptVal: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    newSaleBtn: {
      width: '100%',
      backgroundColor: Brand.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    newSaleBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
