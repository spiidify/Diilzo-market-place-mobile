import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { getMyOrders, type SellerOrder } from '@/services/seller';

const STATUS_COLORS: Record<string, string> = {
  pending: Brand.rating,
  accepted: '#3B82F6',
  processing: '#8B5CF6',
  shipped: '#06B6D4',
  delivered: '#16A34A',
  cancelled: Brand.danger,
  refunded: Brand.textTertiary,
};

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const PERIOD_FILTERS = [
  { key: '', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'this_year', label: 'This Year' },
];

export default function SellerOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const params: { status?: string; search?: string; period?: string } = {};
      if (statusFilter) params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      if (periodFilter) params.period = periodFilter;
      const data = await getMyOrders(Object.keys(params).length ? params : undefined);
      setOrders(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, debouncedSearch, periodFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Summary stats ──────────────────────────────────────────────
  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelled' && o.status !== 'refunded')
    .reduce((sum, o) => sum + Number(o.seller_amount), 0);
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;

  const clearAllFilters = () => {
    setStatusFilter('');
    setPeriodFilter('');
    setSearch('');
  };

  const hasActiveFilters = statusFilter || periodFilter || search;

  const renderItem = ({ item }: { item: SellerOrder }) => {
    const statusColor = STATUS_COLORS[item.status] || Brand.textTertiary;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        onPress={() => router.push(`/seller/orders/${item.id}` as any)}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
            {item.customer_name ? (
              <View style={styles.customerRow}>
                <MaterialCommunityIcons name="account-outline" size={13} color={Brand.textTertiary} />
                <Text style={styles.customerName} numberOfLines={1}>{item.customer_name}</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Subtotal</Text>
            <Text style={styles.amountValue}>UGX {Number(item.subtotal).toLocaleString()}</Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Commission</Text>
            <Text style={[styles.amountValue, { color: Brand.danger }]}>UGX {Number(item.commission_amount).toLocaleString()}</Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Earnings</Text>
            <Text style={[styles.amountValue, { color: Brand.primary }]}>UGX {Number(item.seller_amount).toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            {item.item_count !== undefined && (
              <View style={styles.itemCountBadge}>
                <MaterialCommunityIcons name="package-variant-closed" size={11} color={Brand.primary} />
                <Text style={styles.itemCountText}>{item.item_count} {item.item_count === 1 ? 'item' : 'items'}</Text>
              </View>
            )}
          </View>
          <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader
        title="Orders"
        rightIcon={searchVisible ? 'magnify-close' : 'magnify'}
        onRightPress={() => {
          setSearchVisible(!searchVisible);
          if (searchVisible) setSearch('');
        }}
      />

      {/* Search bar */}
      {searchVisible && (
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color={Brand.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order # or customer name..."
            placeholderTextColor={Brand.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={12}>
              <MaterialCommunityIcons name="close-circle" size={18} color={Brand.textTertiary} />
            </Pressable>
          )}
        </View>
      )}

      {/* Summary stats */}
      {!loading && orders.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>UGX {totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Brand.rating }]}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>{deliveredCount}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </View>
        </View>
      )}

      {/* Filter panel */}
      <View style={styles.filterPanel}>
        <View style={styles.filterHeader}>
          <View style={styles.filterHeaderLeft}>
            <MaterialCommunityIcons name="filter-variant" size={16} color={Brand.text} />
            <Text style={styles.filterHeaderText}>Filters</Text>
          </View>
          {hasActiveFilters ? (
            <Pressable style={styles.clearBtn} onPress={clearAllFilters} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={14} color={Brand.primary} />
              <Text style={styles.clearBtnText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Period chips */}
        <View style={styles.chipSection}>
          <Text style={styles.chipSectionLabel}>PERIOD</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            {PERIOD_FILTERS.map((f) => (
              <Pressable
                key={f.key}
                style={[styles.chip, periodFilter === f.key && styles.chipActiveDark]}
                onPress={() => setPeriodFilter(f.key)}
              >
                <Text style={[styles.chipText, periodFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Status chips */}
        <View style={styles.chipSection}>
          <Text style={styles.chipSectionLabel}>STATUS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            {STATUS_FILTERS.map((f) => (
              <Pressable
                key={f.key}
                style={[styles.chip, statusFilter === f.key && styles.chipActivePrimary]}
                onPress={() => setStatusFilter(f.key)}
              >
                <Text style={[styles.chipText, statusFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Orders list */}
      {loading ? (
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name={hasActiveFilters ? "filter-remove-outline" : "clipboard-list-outline"} size={56} color={Brand.textTertiary} />
          <Text style={styles.emptyText}>{hasActiveFilters ? 'No orders match your filters' : 'No orders yet'}</Text>
          <Text style={styles.emptySub}>{hasActiveFilters ? 'Try adjusting your search or filters' : 'Orders from buyers will appear here'}</Text>
          {hasActiveFilters && (
            <Pressable style={styles.retryBtn} onPress={clearAllFilters}>
              <Text style={styles.retryBtnText}>Clear Filters</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => `${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          maxToRenderPerBatch={10}
          windowSize={11}
          initialNumToRender={10}
          removeClippedSubviews={true}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { marginTop: 12, fontSize: 16, fontWeight: '700', color: Brand.text },
  emptySub: { marginTop: 4, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  // Search bar
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Brand.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: Brand.text, paddingVertical: 4 },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
    alignItems: 'center', gap: 2,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  statValue: { fontSize: 14, fontWeight: '800', color: Brand.text },
  statLabel: { fontSize: 10, color: Brand.textTertiary, fontWeight: '600' },

  // Filter panel
  filterPanel: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 16,
    padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  filterHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterHeaderText: { fontSize: 15, fontWeight: '800', color: Brand.text },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.primary + '12', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  clearBtnText: { fontSize: 12, fontWeight: '700', color: Brand.primary },

  chipSection: { marginBottom: 12 },
  chipSectionLabel: { fontSize: 10, fontWeight: '800', color: Brand.textTertiary, letterSpacing: 1, marginBottom: 8 },
  chipScroll: { gap: 8 },

  chip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20,
    backgroundColor: Brand.surfaceAlt, minHeight: 40, justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipActiveDark: { backgroundColor: Brand.dark, borderColor: Brand.dark },
  chipActivePrimary: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },

  // Orders list
  list: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardTopLeft: { gap: 4, flex: 1 },
  orderNumber: { fontSize: 16, fontWeight: '700', color: Brand.text },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  customerName: { fontSize: 12, color: Brand.textSecondary, fontWeight: '500' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },

  cardBody: { flexDirection: 'row', gap: 8, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F0F2F4' },
  amountCol: { flex: 1, gap: 2 },
  amountLabel: { fontSize: 10, color: Brand.textTertiary, fontWeight: '600', textTransform: 'uppercase' },
  amountValue: { fontSize: 13, fontWeight: '700', color: Brand.text },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLeft: { flexDirection: 'row', gap: 6 },
  itemCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.primary + '12', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  itemCountText: { fontSize: 11, fontWeight: '600', color: Brand.primary },
  dateText: { fontSize: 12, color: Brand.textTertiary },
});
