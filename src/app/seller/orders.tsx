import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { GradientHeader } from '@/components/GradientHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { getMyOrders, type SellerOrder } from '@/services/seller';

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const PERIOD_FILTERS = [
  { key: '', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This week' },
  { key: 'this_month', label: 'This month' },
  { key: 'this_year', label: 'This year' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: Brand.rating,
  accepted: '#3B82F6',
  processing: '#8B5CF6',
  shipped: '#06B6D4',
  delivered: '#16A34A',
  cancelled: Brand.danger,
};

function formatShort(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(Math.round(n));
}

export default function SellerOrdersScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelled' && o.status !== 'refunded')
    .reduce((sum, o) => sum + Number(o.seller_amount), 0);
  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  const clearAllFilters = () => {
    setStatusFilter('');
    setPeriodFilter('');
    setSearch('');
  };

  const hasActiveFilters = !!(statusFilter || periodFilter || search);

  const headerSubtitle = !loading && orders.length > 0
    ? `${orders.length} order${orders.length === 1 ? '' : 's'} · UGX ${formatShort(totalRevenue)}${pendingCount ? ` · ${pendingCount} pending` : ''}`
    : undefined;

  const renderItem = ({ item }: { item: SellerOrder }) => {
    const statusColor = STATUS_COLORS[item.status] || colors.textTertiary;
    const meta = [
      item.customer_name,
      item.item_count !== undefined ? `${item.item_count} item${item.item_count === 1 ? '' : 's'}` : null,
      new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    ].filter(Boolean).join(' · ');

    return (
      <Pressable
        style={({ pressed }) => [styles.orderRow, pressed && { backgroundColor: colors.surfaceAlt }]}
        onPress={() => router.push(`/seller/orders/${item.id}` as any)}
      >
        <View style={styles.orderMain}>
          <View style={styles.orderTop}>
            <Text style={styles.orderNum} numberOfLines={1}>#{item.order_number}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
            </View>
          </View>
          <Text style={styles.orderMeta} numberOfLines={1}>{meta}</Text>
        </View>
        <View style={styles.orderRight}>
          <Text style={styles.orderAmount}>UGX {formatShort(Number(item.seller_amount))}</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textTertiary} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Orders"
        subtitle={headerSubtitle}
        rightIcon={searchVisible ? 'magnify-close' : 'magnify'}
        onRightPress={() => {
          setSearchVisible(!searchVisible);
          if (searchVisible) setSearch('');
        }}
      />

      {/* Search bar */}
      {searchVisible && (
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Order # or customer name..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={12}>
              <MaterialCommunityIcons name="close-circle" size={16} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      )}

      {/* Combined filter row — status chips, then period chips */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {STATUS_FILTERS.map((f) => (
            <Pressable
              key={`s-${f.key}`}
              style={[styles.chip, statusFilter === f.key && styles.chipActive]}
              onPress={() => setStatusFilter(f.key)}
            >
              <Text style={[styles.chipText, statusFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
          <View style={styles.filterSep} />
          {PERIOD_FILTERS.map((f) => (
            <Pressable
              key={`p-${f.key}`}
              style={[styles.chip, periodFilter === f.key && styles.chipActiveDark]}
              onPress={() => setPeriodFilter(f.key)}
            >
              <Text style={[styles.chipText, periodFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
          {hasActiveFilters && (
            <Pressable style={styles.clearChip} onPress={clearAllFilters} hitSlop={6}>
              <MaterialCommunityIcons name="close" size={13} color={Brand.danger} />
              <Text style={styles.clearChipText}>Clear</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {/* Orders list */}
      {loading ? (
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={44} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name={hasActiveFilters ? "filter-remove-outline" : "clipboard-list-outline"} size={48} color={colors.textTertiary} />
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
          style={styles.listCard}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
          maxToRenderPerBatch={12}
          windowSize={11}
          initialNumToRender={12}
          removeClippedSubviews={true}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
        />
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { marginTop: 10, fontSize: 15, fontWeight: '700', color: c.text },
  emptySub: { marginTop: 3, fontSize: 13, color: c.textSecondary, textAlign: 'center' },
  errorText: { marginTop: 10, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10, marginTop: 8 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // Search bar
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.surface, paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: c.text, paddingVertical: 2 },

  // Compact combined filter row
  filterBar: {
    backgroundColor: c.surface,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  filterScroll: { alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8 },

  chip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipActiveDark: { backgroundColor: Brand.dark, borderColor: Brand.dark },
  chipText: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  filterSep: { width: 1, height: 18, backgroundColor: c.border, marginHorizontal: 4 },
  clearChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 14,
  },
  clearChipText: { fontSize: 12, fontWeight: '700', color: Brand.danger },

  // Dense order list — single card, hairline rows
  listCard: { flex: 1 },
  list: {
    margin: 10, borderRadius: 14, overflow: 'hidden',
    backgroundColor: c.surface,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  orderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  orderMain: { flex: 1, gap: 3 },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderNum: { fontSize: 14, fontWeight: '800', color: c.text },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  orderMeta: { fontSize: 12, color: c.textTertiary, fontWeight: '500' },
  orderRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  orderAmount: { fontSize: 13, fontWeight: '800', color: Brand.primary },
  rowDivider: { height: 1, backgroundColor: c.borderLight, marginLeft: 12 },
});
