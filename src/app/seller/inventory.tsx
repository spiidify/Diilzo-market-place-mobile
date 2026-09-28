import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { GradientHeader } from '@/components/GradientHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import {
    getInventory,
    getInventoryMovements,
    getInventoryProductDetail,
    getInventoryReorderCount,
    getProductReservations,
    receiveStock,
    updateStock,
    type InventoryItem,
    type InventoryKpis,
    type InventoryProductDetail,
    type StockMovementRow,
} from '@/services/seller';

type Tab = 'stock' | 'activity' | 'receive';
type StatusFilter = '' | 'in' | 'low' | 'out';
type AdjustMode = 'set' | 'add' | 'remove';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'in', label: 'In Stock' },
  { key: 'low', label: 'Low' },
  { key: 'out', label: 'Out' },
];

const REASONS: { key: string; label: string }[] = [
  { key: 'restock', label: 'Restock' },
  { key: 'sale_return', label: 'Sale Return' },
  { key: 'damage', label: 'Damaged' },
  { key: 'count_correction', label: 'Count Correction' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'manual', label: 'Manual' },
  { key: 'other', label: 'Other' },
];

const REASON_COLORS: Record<string, string> = {
  restock: '#16A34A',
  sale: '#3B82F6',
  sale_return: '#06B6D4',
  damage: '#DC2626',
  count_correction: '#8B5CF6',
  transfer: '#F59E0B',
  manual: '#6B7280',
  other: '#6B7280',
};

const QUICK_CHIPS = [1, 5, 10, 50];
const MAX_REASONABLE = 100_000_000;

function reasonColor(reason: string): string {
  return REASON_COLORS[reason] || '#6B7280';
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function SellerInventoryScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tab, setTab] = useState<Tab>('stock');
  const [reorderCount, setReorderCount] = useState(0);

  // ── Stock tab state ──
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [kpis, setKpis] = useState<InventoryKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchSeq = useRef(0);

  // ── Activity tab state ──
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [mvLoading, setMvLoading] = useState(false);
  const [mvPage, setMvPage] = useState(1);
  const [mvHasMore, setMvHasMore] = useState(false);
  const [mvLoaded, setMvLoaded] = useState(false);

  // ── Receive tab state ──
  const [rcvQuery, setRcvQuery] = useState('');
  const [rcvResults, setRcvResults] = useState<InventoryItem[]>([]);
  const [rcvProduct, setRcvProduct] = useState<InventoryItem | null>(null);
  const [rcvSupplier, setRcvSupplier] = useState('');
  const [rcvQty, setRcvQty] = useState('');
  const [rcvCost, setRcvCost] = useState('');
  const [rcvSaving, setRcvSaving] = useState(false);
  const rcvTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Modals ──
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjMode, setAdjMode] = useState<AdjustMode>('set');
  const [adjQty, setAdjQty] = useState(0);
  const [adjReason, setAdjReason] = useState('restock');
  const [adjNote, setAdjNote] = useState('');
  const [adjReorder, setAdjReorder] = useState('');
  const [adjSaving, setAdjSaving] = useState(false);

  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
  const [viewDetail, setViewDetail] = useState<InventoryProductDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [resItem, setResItem] = useState<InventoryItem | null>(null);
  const [resRows, setResRows] = useState<{ id: number; quantity: number; holder: string; expires_at: string }[]>([]);
  const [resLoading, setResLoading] = useState(false);

  // ── Stock list loading ──
  const load = useCallback(async (pageNum = 1, append = false, q = search, st = status) => {
    const seq = ++fetchSeq.current;
    try {
      if (append) setLoadingMore(true); else setRefreshing(true);
      const data = await getInventory({
        q: q || undefined,
        status: st || undefined,
        page: pageNum,
        page_size: 30,
      });
      if (seq !== fetchSeq.current) return; // stale response
      setItems((prev) => (append ? [...prev, ...data.results] : data.results));
      setHasMore(data.has_next);
      setTotal(data.count);
      if (data.kpis) setKpis(data.kpis);
      setPage(pageNum);
    } catch (e: any) {
      if (seq === fetchSeq.current) Alert.alert('Error', e?.message || 'Failed to load inventory');
    } finally {
      if (seq === fetchSeq.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [search, status]);

  useEffect(() => { load(1); }, [load]);

  useEffect(() => {
    getInventoryReorderCount().then((r) => setReorderCount(r.count)).catch(() => {});
  }, []);

  const onSearchChange = (text: string) => {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(1, false, text, status), 300);
  };

  const pickStatus = (st: StatusFilter) => {
    setStatus(st);
    load(1, false, search, st);
  };

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    load(page + 1, true);
  }, [load, page, hasMore, loading, loadingMore]);

  // ── Activity loading ──
  const loadMovements = useCallback(async (pageNum = 1, append = false) => {
    try {
      setMvLoading(true);
      const data = await getInventoryMovements({ page: pageNum, page_size: 30 });
      setMovements((prev) => (append ? [...prev, ...data.results] : data.results));
      setMvHasMore(data.has_next);
      setMvPage(pageNum);
      setMvLoaded(true);
    } catch {
      // non-critical
    } finally {
      setMvLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'activity' && !mvLoaded) loadMovements(1);
  }, [tab, mvLoaded, loadMovements]);

  // ── Receive: product picker search ──
  const onRcvQueryChange = (text: string) => {
    setRcvQuery(text);
    if (rcvTimer.current) clearTimeout(rcvTimer.current);
    if (!text.trim()) { setRcvResults([]); return; }
    rcvTimer.current = setTimeout(async () => {
      try {
        const data = await getInventory({ q: text.trim(), page_size: 8 });
        setRcvResults(data.results);
      } catch { /* ignore */ }
    }, 300);
  };

  const submitReceive = async () => {
    if (!rcvProduct) { Alert.alert('Select a product', 'Search and pick the product being received.'); return; }
    const qty = parseInt(rcvQty, 10);
    if (!qty || qty <= 0) { Alert.alert('Invalid quantity', 'Enter how many units arrived.'); return; }
    const cost = rcvCost.trim() ? parseFloat(rcvCost) : undefined;
    if (rcvCost.trim() && (cost === undefined || isNaN(cost) || cost < 0)) {
      Alert.alert('Invalid cost', 'Unit cost must be a positive number.');
      return;
    }
    try {
      setRcvSaving(true);
      const res = await receiveStock({
        product: rcvProduct.id,
        quantity: qty,
        supplier: rcvSupplier.trim() || undefined,
        unit_cost: cost,
      });
      Alert.alert('Received', `${res.product_name}: +${res.quantity_received} (on hand ${res.stock_quantity}) · ${res.po_number}`);
      setRcvProduct(null);
      setRcvQuery('');
      setRcvResults([]);
      setRcvSupplier('');
      setRcvQty('');
      setRcvCost('');
      setMvLoaded(false);
      load(1);
    } catch (e: any) {
      Alert.alert('Receive failed', e?.response?.data?.error || e?.message || 'Could not receive stock');
    } finally {
      setRcvSaving(false);
    }
  };

  // ── Adjust modal ──
  const openAdjust = (item: InventoryItem) => {
    setAdjustItem(item);
    setAdjMode('set');
    setAdjQty(item.stock_quantity);
    setAdjReason('count_correction');
    setAdjNote('');
    setAdjReorder(String(item.reorder_point ?? 5));
  };

  const setMode = (m: AdjustMode) => {
    setAdjMode(m);
    if (!adjustItem) return;
    setAdjQty(m === 'set' ? adjustItem.stock_quantity : 1);
    setAdjReason(m === 'set' ? 'count_correction' : m === 'add' ? 'restock' : 'damage');
  };

  const projected = useMemo(() => {
    if (!adjustItem) return 0;
    if (adjMode === 'set') return Math.max(0, adjQty);
    if (adjMode === 'add') return adjustItem.stock_quantity + Math.max(0, adjQty);
    return Math.max(0, adjustItem.stock_quantity - Math.max(0, adjQty));
  }, [adjustItem, adjMode, adjQty]);

  const delta = adjustItem ? projected - adjustItem.stock_quantity : 0;

  const stepQty = (d: number) => {
    setAdjQty((q) => {
      let next = q + d;
      if (adjMode === 'remove' && adjustItem) next = Math.min(next, adjustItem.stock_quantity);
      return Math.max(0, Math.min(next, MAX_REASONABLE));
    });
  };

  const saveAdjust = async () => {
    if (!adjustItem || adjSaving) return;
    if (projected === adjustItem.stock_quantity && adjReorder === String(adjustItem.reorder_point)) {
      setAdjustItem(null);
      return;
    }
    try {
      setAdjSaving(true);
      const rp = parseInt(adjReorder, 10);
      const res = await updateStock(adjustItem.id, projected, {
        reason: adjReason,
        note: adjNote.trim() || undefined,
        reorder_point: isNaN(rp) ? undefined : rp,
      });
      setItems((prev) => prev.map((p) => (p.id === adjustItem.id
        ? {
            ...p,
            stock_quantity: res.new_stock_quantity,
            reorder_point: res.reorder_point ?? p.reorder_point,
            available_quantity: Math.max(0, res.new_stock_quantity - p.reserved_quantity),
            stock_value: (p.cost_price ?? p.final_price) * res.new_stock_quantity,
          }
        : p)));
      setAdjustItem(null);
      setMvLoaded(false);
      getInventoryReorderCount().then((r) => setReorderCount(r.count)).catch(() => {});
      Alert.alert('Saved', `${res.name}: ${res.old_stock_quantity} → ${res.new_stock_quantity}`);
    } catch (e: any) {
      Alert.alert('Save failed', e?.response?.data?.error || e?.message || 'Could not update stock');
    } finally {
      setAdjSaving(false);
    }
  };

  // ── Quick view ──
  const openView = (item: InventoryItem) => {
    setViewItem(item);
    setViewDetail(null);
    setViewLoading(true);
    getInventoryProductDetail(item.id)
      .then(setViewDetail)
      .catch(() => {})
      .finally(() => setViewLoading(false));
  };

  // ── Reservations ──
  const openReservations = (item: InventoryItem) => {
    if (!item.reserved_quantity) return;
    setResItem(item);
    setResRows([]);
    setResLoading(true);
    getProductReservations(item.id)
      .then((d) => setResRows(d.reservations))
      .catch(() => {})
      .finally(() => setResLoading(false));
  };

  // ── Row renderer ──
  const renderRow = ({ item }: { item: InventoryItem }) => {
    const rp = item.reorder_point ?? 5;
    const stockColor = item.stock_quantity === 0 ? Brand.danger : item.stock_quantity <= rp ? Brand.rating : Brand.primary;
    const barPct = `${Math.min(100, Math.round((item.stock_quantity / Math.max(1, rp * 4)) * 100))}%` as const;
    return (
      <View style={styles.row}>
        {item.primary_image_url ? (
          <Image source={{ uri: item.primary_image_url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <MaterialCommunityIcons name="package-variant" size={18} color={colors.textTertiary} />
          </View>
        )}
        <View style={styles.rowMain}>
          <View style={styles.rowTop}>
            <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
            {!item.is_active && <Text style={styles.draftTag}>Draft</Text>}
          </View>
          <Text style={styles.rowMeta} numberOfLines={1}>
            UGX {Number(item.final_price || item.price).toLocaleString()}
            {item.sku ? ` · ${item.sku}` : ''}
            {item.category_name ? ` · ${item.category_name}` : ''}
          </Text>
          <View style={styles.stockLine}>
            <Text style={[styles.qtyText, { color: stockColor }]}>{item.stock_quantity}</Text>
            <View style={styles.barWrap}>
              <View style={[styles.barFill, { width: barPct, backgroundColor: stockColor }]} />
            </View>
            <Text style={[styles.statusPill, { color: stockColor }]}>
              {item.stock_quantity === 0 ? 'Out' : item.stock_quantity <= rp ? 'Low' : 'In stock'}
            </Text>
            <Pressable onPress={() => openReservations(item)} hitSlop={6}>
              <Text style={styles.resText}>{item.reserved_quantity} res</Text>
            </Pressable>
          </View>
          <Text style={styles.rowValue} numberOfLines={1}>
            Value <Text style={styles.rowValueFigure}>UGX {Math.round(item.stock_value || 0).toLocaleString()}</Text>
            {' '}· {item.available_quantity} avail
          </Text>
        </View>
        <View style={styles.rowActions}>
          <Pressable style={styles.adjustBtn} onPress={() => openAdjust(item)} hitSlop={4}>
            <MaterialCommunityIcons name="plus-minus-variant" size={13} color={Brand.primary} />
            <Text style={styles.adjustBtnText}>Adjust</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => openView(item)} hitSlop={6}>
            <MaterialCommunityIcons name="eye-outline" size={17} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push(`/seller/products/edit?id=${item.id}` as any)}
            hitSlop={6}
          >
            <MaterialCommunityIcons name="pencil-outline" size={16} color={Brand.primary} />
          </Pressable>
        </View>
      </View>
    );
  };

  const renderMovement = ({ item }: { item: StockMovementRow }) => {
    const c = item.change >= 0 ? Brand.primary : Brand.danger;
    return (
      <View style={styles.mvRow}>
        <View style={[styles.mvDot, { backgroundColor: reasonColor(item.reason) }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.mvProduct} numberOfLines={1}>{item.product_name}</Text>
          <Text style={styles.mvMeta} numberOfLines={2}>
            {item.reason_label}
            {item.note ? ` · ${item.note}` : ''}
            {item.reference ? ` · ${item.reference}` : ''}
          </Text>
          <Text style={styles.mvBy}>
            {fmtDate(item.created_at)} · {item.performed_by}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.mvChange, { color: c }]}>{item.change >= 0 ? '+' : ''}{item.change}</Text>
          <Text style={styles.mvAfter}>= {item.after}</Text>
        </View>
      </View>
    );
  };

  // ── Render ──
  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Inventory"
        subtitle={reorderCount > 0 ? `${reorderCount} product${reorderCount === 1 ? '' : 's'} at reorder point` : 'Stock management'}
        rightIcon={tab === 'stock' ? 'refresh' : undefined}
        onRightPress={() => { setMvLoaded(false); load(1); }}
      />

      {/* ── Tabs ── */}
      <View style={styles.tabBar}>
        {([['stock', 'cube-outline', 'Stock'], ['activity', 'history', 'Activity'], ['receive', 'truck-delivery-outline', 'Receive']] as [Tab, string, string][]).map(([t, icon, label]) => (
          <Pressable key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <MaterialCommunityIcons name={icon as any} size={17} color={tab === t ? Brand.primary : colors.textTertiary} />
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{label}</Text>
            {t === 'stock' && reorderCount > 0 && (
              <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{reorderCount}</Text></View>
            )}
          </Pressable>
        ))}
      </View>

      {tab === 'stock' && (
        <>
          {/* KPI strip */}
          {kpis && (
            <View style={styles.kpiStrip}>
              <View style={styles.kpi}>
                <Text style={styles.kpiNum}>{kpis.units.toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>Units</Text>
              </View>
              <View style={styles.kpi}>
                <Text style={[styles.kpiNum, { color: '#8B5CF6' }]}>UGX {Math.round(kpis.value).toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>Value</Text>
              </View>
            </View>
          )}

          {/* Search + status pills */}
          <View style={styles.searchWrap}>
            <MaterialCommunityIcons name="magnify" size={18} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search name or SKU..."
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={onSearchChange}
              autoCapitalize="none"
            />
            {!!search && (
              <Pressable onPress={() => onSearchChange('')} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle" size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
          <View style={styles.pillRow}>
            {STATUS_TABS.map((t) => {
              const count = !kpis ? null
                : t.key === '' ? kpis.skus
                : t.key === 'in' ? Math.max(0, kpis.skus - kpis.low - kpis.out)
                : t.key === 'low' ? kpis.low
                : kpis.out;
              return (
                <Pressable
                  key={t.key}
                  style={[styles.pill, status === t.key && styles.pillActive]}
                  onPress={() => pickStatus(t.key)}
                >
                  <Text style={[styles.pillText, status === t.key && styles.pillTextActive]}>
                    {t.label}{count !== null ? ` ${count}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {loading && items.length === 0 ? (
            <View style={styles.center}><ActivityIndicator size="large" color={Brand.primary} /></View>
          ) : items.length === 0 ? (
            <View style={styles.center}>
              <MaterialCommunityIcons name="package-variant-closed" size={52} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(it) => String(it.id)}
              renderItem={renderRow}
              contentContainerStyle={{ paddingBottom: 24 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(1)} colors={[Brand.primary]} tintColor={Brand.primary} />}
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                loadingMore ? (
                  <ActivityIndicator size="small" color={Brand.primary} style={{ paddingVertical: 14 }} />
                ) : !hasMore && items.length > 15 ? (
                  <Text style={styles.endText}>All {total} products loaded</Text>
                ) : null
              }
            />
          )}
        </>
      )}

      {tab === 'activity' && (
        <>
          {mvLoading && movements.length === 0 ? (
            <View style={styles.center}><ActivityIndicator size="large" color={Brand.primary} /></View>
          ) : movements.length === 0 ? (
            <View style={styles.center}>
              <MaterialCommunityIcons name="history" size={52} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No stock activity yet</Text>
              <Text style={styles.emptySub}>Stock changes will appear here with who made them</Text>
            </View>
          ) : (
            <FlatList
              data={movements}
              keyExtractor={(it) => String(it.id)}
              renderItem={renderMovement}
              contentContainerStyle={{ paddingBottom: 24 }}
              refreshControl={<RefreshControl refreshing={mvLoading} onRefresh={() => loadMovements(1)} colors={[Brand.primary]} tintColor={Brand.primary} />}
              onEndReached={() => { if (mvHasMore && !mvLoading) loadMovements(mvPage + 1, true); }}
              onEndReachedThreshold={0.4}
            />
          )}
        </>
      )}

      {tab === 'receive' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.rcvTitle}>Receive stock from supplier</Text>
          <Text style={styles.rcvSub}>Creates a purchase record, bumps on-hand, and logs it in Activity.</Text>

          <Text style={styles.fieldLabel}>Product</Text>
          {rcvProduct ? (
            <View style={styles.rcvPicked}>
              {rcvProduct.primary_image_url ? (
                <Image source={{ uri: rcvProduct.primary_image_url }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <MaterialCommunityIcons name="package-variant" size={16} color={colors.textTertiary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>{rcvProduct.name}</Text>
                <Text style={styles.rowMeta}>On hand: {rcvProduct.stock_quantity}{rcvProduct.sku ? ` · ${rcvProduct.sku}` : ''}</Text>
              </View>
              <Pressable onPress={() => setRcvProduct(null)} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle" size={18} color={colors.textTertiary} />
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.searchWrap}>
                <MaterialCommunityIcons name="magnify" size={18} color={colors.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search product to receive..."
                  placeholderTextColor={colors.textTertiary}
                  value={rcvQuery}
                  onChangeText={onRcvQueryChange}
                  autoCapitalize="none"
                />
              </View>
              {rcvResults.map((p) => (
                <Pressable key={p.id} style={styles.rcvResult} onPress={() => { setRcvProduct(p); setRcvResults([]); setRcvQuery(''); }}>
                  <Text style={styles.rowName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.rowMeta}>{p.sku || 'No SKU'} · on hand {p.stock_quantity}</Text>
                </Pressable>
              ))}
            </>
          )}

          <Text style={styles.fieldLabel}>Supplier (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Kampala Traders Ltd"
            placeholderTextColor={colors.textTertiary}
            value={rcvSupplier}
            onChangeText={setRcvSupplier}
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={rcvQty}
                onChangeText={setRcvQty}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Unit cost (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="UGX"
                placeholderTextColor={colors.textTertiary}
                value={rcvCost}
                onChangeText={setRcvCost}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Pressable
            style={[styles.receiveBtn, (rcvSaving || !rcvProduct) && { opacity: 0.5 }]}
            onPress={submitReceive}
            disabled={rcvSaving || !rcvProduct}
          >
            {rcvSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="package-variant-plus" size={18} color="#fff" />
                <Text style={styles.receiveBtnText}>Receive Stock</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      )}

      {/* ── Adjust modal ── */}
      <Modal visible={!!adjustItem} transparent animationType="fade" onRequestClose={() => setAdjustItem(null)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Adjust Stock</Text>
                <Text style={styles.sheetSub} numberOfLines={1}>
                  {adjustItem?.name} · on hand {adjustItem?.stock_quantity}
                </Text>
              </View>
              <Pressable onPress={() => setAdjustItem(null)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Mode tabs */}
              <View style={styles.modeRow}>
                {([['set', 'Set to'], ['add', 'Add'], ['remove', 'Remove']] as [AdjustMode, string][]).map(([m, label]) => (
                  <Pressable key={m} style={[styles.modeBtn, adjMode === m && styles.modeBtnActive]} onPress={() => setMode(m)}>
                    <Text style={[styles.modeText, adjMode === m && styles.modeTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Stepper */}
              <View style={styles.stepperRow}>
                <Pressable style={styles.stepBtn} onPress={() => stepQty(-1)}>
                  <MaterialCommunityIcons name="minus" size={22} color={Brand.danger} />
                </Pressable>
                <TextInput
                  style={styles.stepInput}
                  value={String(adjQty)}
                  onChangeText={(t) => setAdjQty(Math.max(0, Math.min(parseInt(t.replace(/\D/g, '') || '0', 10), MAX_REASONABLE)))}
                  keyboardType="number-pad"
                />
                <Pressable style={styles.stepBtn} onPress={() => stepQty(1)}>
                  <MaterialCommunityIcons name="plus" size={22} color={Brand.primary} />
                </Pressable>
              </View>

              {/* Quick chips */}
              <View style={styles.chipRow}>
                {QUICK_CHIPS.map((n) => (
                  <Pressable key={n} style={styles.qChip} onPress={() => stepQty(n)}>
                    <Text style={styles.qChipText}>+{n}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Preview + delta */}
              <View style={styles.previewRow}>
                <Text style={styles.previewText}>New on-hand: <Text style={{ fontWeight: '800', color: colors.text }}>{projected}</Text></Text>
                {delta !== 0 && (
                  <Text style={[styles.deltaBadge, { color: delta > 0 ? Brand.primary : Brand.danger }]}>
                    {delta > 0 ? '+' : ''}{delta}
                  </Text>
                )}
              </View>

              {/* Reason */}
              <Text style={styles.fieldLabel}>Reason</Text>
              <View style={styles.reasonWrap}>
                {REASONS.map((r) => (
                  <Pressable
                    key={r.key}
                    style={[styles.reasonChip, adjReason === r.key && { borderColor: Brand.primary, backgroundColor: Brand.primary + '12' }]}
                    onPress={() => setAdjReason(r.key)}
                  >
                    <Text style={[styles.reasonChipText, adjReason === r.key && { color: Brand.primary }]}>{r.label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Note */}
              <Text style={styles.fieldLabel}>Note (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Damaged in transit"
                placeholderTextColor={colors.textTertiary}
                value={adjNote}
                onChangeText={setAdjNote}
              />

              {/* Reorder point */}
              <Text style={styles.fieldLabel}>Reorder alert below</Text>
              <TextInput
                style={styles.input}
                placeholder="5"
                placeholderTextColor={colors.textTertiary}
                value={adjReorder}
                onChangeText={setAdjReorder}
                keyboardType="number-pad"
              />

              <Pressable style={[styles.saveBtn, adjSaving && { opacity: 0.6 }]} onPress={saveAdjust} disabled={adjSaving}>
                {adjSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save Stock</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Quick view modal ── */}
      <Modal visible={!!viewItem} transparent animationType="fade" onRequestClose={() => setViewItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Product Details</Text>
                <Text style={styles.sheetSub} numberOfLines={1}>{viewItem?.name}</Text>
              </View>
              <Pressable onPress={() => setViewItem(null)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {viewLoading || !viewDetail ? (
              <ActivityIndicator size="large" color={Brand.primary} style={{ marginVertical: 40 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Identity */}
                <View style={styles.viewHeadRow}>
                  {viewDetail.primary_image_url ? (
                    <Image source={{ uri: viewDetail.primary_image_url }} style={styles.viewImg} />
                  ) : (
                    <View style={[styles.viewImg, styles.thumbFallback]}>
                      <MaterialCommunityIcons name="package-variant" size={26} color={colors.textTertiary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.viewName} numberOfLines={2}>{viewDetail.name}</Text>
                    <Text style={styles.rowMeta} numberOfLines={2}>
                      {[viewDetail.sku && `SKU ${viewDetail.sku}`, viewDetail.barcode, viewDetail.category_name, viewDetail.brand_name]
                        .filter(Boolean).join(' · ')}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <Text style={[styles.statusPill, { color: viewDetail.is_active ? Brand.primary : Brand.rating }]}>
                        {viewDetail.is_active ? 'Active' : 'Draft'}
                      </Text>
                      <Pressable onPress={() => { setViewItem(null); router.push(`/seller/products/edit?id=${viewDetail.id}` as any); }}>
                        <Text style={{ color: Brand.primary, fontSize: 12, fontWeight: '700' }}>Edit →</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* Stats grid */}
                <View style={styles.statGrid}>
                  {[
                    ['Price', `UGX ${viewDetail.final_price.toLocaleString()}`],
                    ['On Hand', String(viewDetail.stock_quantity)],
                    ['Reserved', String(viewDetail.reserved_quantity)],
                    ['Available', String(viewDetail.available_quantity)],
                    ['Reorder At', String(viewDetail.reorder_point)],
                    ['Unit Cost', viewDetail.cost_price != null ? `UGX ${viewDetail.cost_price.toLocaleString()}` : '—'],
                  ].map(([label, val]) => (
                    <View key={label} style={styles.statCell}>
                      <Text style={styles.statLabel}>{label}</Text>
                      <Text style={styles.statValue}>{val}</Text>
                    </View>
                  ))}
                </View>

                {/* Warehouses */}
                {viewDetail.warehouses.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>Warehouse Stock</Text>
                    {viewDetail.warehouses.map((w, i) => (
                      <View key={i} style={styles.whRow}>
                        <Text style={styles.whName} numberOfLines={1}>{w.warehouse_name}{w.warehouse_code ? ` (${w.warehouse_code})` : ''}</Text>
                        <Text style={styles.whNums}>{w.quantity} qty · {w.reserved_quantity} res · {w.available_quantity} avail</Text>
                      </View>
                    ))}
                  </>
                )}

                {/* Movements */}
                <Text style={styles.sectionLabel}>Stock History ({viewDetail.movement_count})</Text>
                {viewDetail.movements.length === 0 ? (
                  <Text style={styles.emptySub}>No recorded changes yet</Text>
                ) : (
                  viewDetail.movements.map((m) => {
                    const c = m.change >= 0 ? Brand.primary : Brand.danger;
                    return (
                      <View key={m.id} style={styles.mvRow}>
                        <View style={[styles.mvDot, { backgroundColor: reasonColor(m.reason) }]} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.mvMeta} numberOfLines={2}>
                            {m.reason_label}
                            {m.note ? ` · ${m.note}` : ''}
                            {m.reference ? ` · ${m.reference}` : ''}
                          </Text>
                          <Text style={styles.mvBy}>{fmtDate(m.created_at)} · {m.performed_by}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.mvChange, { color: c }]}>{m.change >= 0 ? '+' : ''}{m.change}</Text>
                          <Text style={styles.mvAfter}>{m.before} → {m.after}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Reservations modal ── */}
      <Modal visible={!!resItem} transparent animationType="fade" onRequestClose={() => setResItem(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { maxHeight: '55%' }]}>
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Reserved Stock</Text>
                <Text style={styles.sheetSub} numberOfLines={1}>
                  {resItem?.name} · {resItem?.reserved_quantity} unit{resItem?.reserved_quantity === 1 ? '' : 's'} held
                </Text>
              </View>
              <Pressable onPress={() => setResItem(null)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            {resLoading ? (
              <ActivityIndicator size="large" color={Brand.primary} style={{ marginVertical: 30 }} />
            ) : resRows.length === 0 ? (
              <Text style={[styles.emptySub, { marginVertical: 24 }]}>No active reservations right now.</Text>
            ) : (
              <FlatList
                data={resRows}
                keyExtractor={(r) => String(r.id)}
                renderItem={({ item: r }) => (
                  <View style={styles.resRow}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color={Brand.rating} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{r.holder}</Text>
                      <Text style={styles.rowMeta}>Expires {fmtDate(r.expires_at)}</Text>
                    </View>
                    <Text style={styles.resQty}>×{r.quantity}</Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyText: { marginTop: 12, fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  emptySub: { marginTop: 4, fontSize: 12, color: colors.textTertiary, textAlign: 'center' },
  endText: { textAlign: 'center', fontSize: 11, color: colors.textTertiary, paddingVertical: 14 },

  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 11,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: Brand.primary },
  tabLabel: { fontSize: 12.5, fontWeight: '600', color: colors.textTertiary },
  tabLabelActive: { color: Brand.primary },
  tabBadge: {
    backgroundColor: Brand.rating, borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  kpiStrip: {
    flexDirection: 'row', backgroundColor: colors.surface, marginHorizontal: 12, marginTop: 10,
    borderRadius: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border,
  },
  kpi: { flex: 1, alignItems: 'center' },
  kpiNum: { fontSize: 14, fontWeight: '800', color: colors.text },
  kpiLabel: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 10, height: 40,
    marginHorizontal: 12, marginTop: 10,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.text, padding: 0 },

  pillRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  pill: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: 4, paddingVertical: 7, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  pillActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  pillText: { fontSize: 11.5, fontWeight: '600', color: colors.textSecondary },
  pillTextActive: { color: '#fff' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, marginHorizontal: 12, marginBottom: 8,
    borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border,
  },
  thumb: { width: 42, height: 42, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  rowMain: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1 },
  draftTag: {
    fontSize: 9, fontWeight: '800', color: Brand.rating,
    backgroundColor: Brand.rating + '18', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4,
  },
  rowMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  stockLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  qtyText: { fontSize: 13, fontWeight: '800' },
  barWrap: { width: 50, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  statusPill: { fontSize: 10, fontWeight: '700' },
  resText: { fontSize: 10, fontWeight: '700', color: Brand.rating, textDecorationLine: 'underline' },
  rowActions: { alignItems: 'flex-end', gap: 6 },
  rowValue: { fontSize: 10.5, fontWeight: '600', color: colors.textTertiary, marginTop: 3 },
  rowValueFigure: { fontWeight: '800', color: '#8B5CF6' },
  adjustBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Brand.primary + '14', borderWidth: 1, borderColor: Brand.primary + '44',
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4,
  },
  adjustBtnText: { fontSize: 10.5, fontWeight: '700', color: Brand.primary },
  iconBtn: { padding: 2 },

  mvRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.surface, marginHorizontal: 12, marginBottom: 8,
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border,
  },
  mvDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  mvProduct: { fontSize: 13, fontWeight: '700', color: colors.text },
  mvMeta: { fontSize: 11.5, color: colors.textSecondary, marginTop: 1 },
  mvBy: { fontSize: 10.5, color: colors.textTertiary, marginTop: 3 },
  mvChange: { fontSize: 14, fontWeight: '800' },
  mvAfter: { fontSize: 10.5, color: colors.textTertiary, marginTop: 1 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 18 },
  sheet: {
    backgroundColor: colors.surface, borderRadius: 18, padding: 18,
    maxHeight: '88%', width: '100%', maxWidth: 480, alignSelf: 'center',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  sheetSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },

  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  modeBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center',
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  modeBtnActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  modeText: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary },
  modeTextActive: { color: '#fff' },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  stepInput: {
    flex: 1, height: 52, textAlign: 'center', fontSize: 26, fontWeight: '800',
    color: colors.text, backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
  },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'center' },
  qChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  qChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  previewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 12, marginBottom: 4,
  },
  previewText: { fontSize: 12.5, color: colors.textTertiary },
  deltaBadge: { fontSize: 13, fontWeight: '800' },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textTertiary, marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13.5, color: colors.text,
  },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reasonChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt,
  },
  reasonChipText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },

  saveBtn: {
    marginTop: 16, backgroundColor: Brand.primary, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', marginBottom: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  viewHeadRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  viewImg: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.surfaceAlt },
  viewName: { fontSize: 14.5, fontWeight: '800', color: colors.text },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  statCell: {
    width: '31%', flexGrow: 1, backgroundColor: colors.surfaceAlt,
    borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border,
  },
  statLabel: { fontSize: 9.5, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' },
  statValue: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 3 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: colors.text, marginTop: 14, marginBottom: 8 },
  whRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  whName: { fontSize: 12.5, fontWeight: '600', color: colors.text, flex: 1 },
  whNums: { fontSize: 11.5, color: colors.textSecondary },

  resRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  resQty: { fontSize: 14, fontWeight: '800', color: Brand.rating },

  rcvTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  rcvSub: { fontSize: 12, color: colors.textTertiary, marginTop: 3, marginBottom: 14 },
  rcvPicked: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: Brand.primary + '55',
    borderRadius: 10, padding: 8,
  },
  rcvResult: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 10, marginTop: 6,
  },
  receiveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, borderRadius: 12, paddingVertical: 13, marginTop: 20,
  },
  receiveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
