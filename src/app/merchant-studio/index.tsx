import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import {
  confirmPackagedItem,
  getMerchantOrders,
  getMerchantProducts,
  type MerchantOrder,
  type MerchantProduct,
} from '@/services/dashboardApi';

type Tab = 'inventory' | 'orders';

export default function MerchantStudioScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('inventory');
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const [prodData, orderData] = await Promise.all([
        getMerchantProducts().catch(() => [] as MerchantProduct[]),
        getMerchantOrders().catch(() => [] as MerchantOrder[]),
      ]);
      setProducts(prodData);
      setOrders(orderData);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleConfirmPackaged = (order: MerchantOrder) => {
    Alert.alert(
      'Confirm Packaged Item',
      `Mark order ${order.order_number} as packaged and ready for dispatch?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            setConfirmingId(order.id);
            try {
              const result = await confirmPackagedItem(order.id);
              setOrders((prev) =>
                prev.map((o) =>
                  o.id === order.id
                    ? { ...o, status: result.status, accepted_at: result.accepted_at }
                    : o
                )
              );
              Alert.alert('Success', result.detail);
            } catch (e: any) {
              Alert.alert(
                'Error',
                e?.response?.data?.detail || e?.message || 'Failed to confirm packaged item'
              );
            } finally {
              setConfirmingId(null);
            }
          },
        },
      ]
    );
  };

  const activeProducts = products.filter((p) => p.is_active);

  if (loading && products.length === 0 && orders.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Merchant Studio" subtitle="Inventory & Dispatch" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
          <Text style={styles.loadingText}>Loading Merchant Studio...</Text>
        </View>
      </View>
    );
  }

  const renderProduct = ({ item }: { item: MerchantProduct }) => (
    <View style={styles.productCard}>
      <View style={styles.productImageWrap}>
        {item.primary_image ? (
          <Image source={{ uri: item.primary_image }} style={styles.productImage} resizeMode="contain" />
        ) : (
          <View style={styles.productImageFallback}>
            <MaterialCommunityIcons name="package-variant" size={24} color={Brand.textTertiary} />
          </View>
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.productPrice}>UGX {Number(item.final_price || item.price).toLocaleString()}</Text>
        <View style={styles.productMetaRow}>
          <View style={[styles.stockBadge, item.is_in_stock ? styles.stockIn : styles.stockOut]}>
            <Text style={styles.stockBadgeText}>{item.is_in_stock ? 'In Stock' : 'Out'}</Text>
          </View>
          <View style={[styles.statusBadge, item.is_active ? styles.statusActive : styles.statusInactive]}>
            <Text style={styles.statusBadgeText}>{item.is_active ? 'Active' : 'Inactive'}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderOrder = ({ item }: { item: MerchantOrder }) => {
    const statusStyles: Record<string, any> = {
      pending: styles.status_pending,
      accepted: styles.status_accepted,
      processing: styles.status_processing,
      shipped: styles.status_shipped,
      delivered: styles.status_delivered,
      cancelled: styles.status_cancelled,
    };
    const statusStyle = statusStyles[item.status] || styles.status_pending;
    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderNumber}>{item.order_number}</Text>
          <View style={[styles.orderStatusBadge, statusStyle]}>
            <Text style={styles.orderStatusText}>{item.status}</Text>
          </View>
        </View>
        <View style={styles.orderMeta}>
          <MaterialCommunityIcons name="account-outline" size={14} color={Brand.textTertiary} />
          <Text style={styles.orderMetaText}>{item.customer_email || item.customer_name || 'Customer'}</Text>
        </View>
        <View style={styles.orderMeta}>
          <MaterialCommunityIcons name="package-variant" size={14} color={Brand.textTertiary} />
          <Text style={styles.orderMetaText}>{item.items_count || 0} items · UGX {Number(item.total || 0).toLocaleString()}</Text>
        </View>
        {(item.status === 'pending' || item.status === 'accepted') && (
          <Pressable
            style={({ pressed }) => [
              styles.confirmBtn,
              (confirmingId === item.id || pressed) && { opacity: 0.85 },
            ]}
            onPress={() => handleConfirmPackaged(item)}
            disabled={confirmingId === item.id}
          >
            {confirmingId === item.id ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="package-variant-closed" size={18} color="#FFFFFF" />
                <Text style={styles.confirmBtnText}>Confirm Packaged Item</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="Merchant Studio" subtitle="Inventory & Dispatch" />

      {/* ── Tab bar ────────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, tab === 'inventory' && styles.tabActive]}
          onPress={() => setTab('inventory')}
        >
          <MaterialCommunityIcons name="package-variant-closed" size={20} color={tab === 'inventory' ? Brand.primary : Brand.textTertiary} />
          <Text style={[styles.tabText, tab === 'inventory' && styles.tabTextActive]}>
            Inventory ({products.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'orders' && styles.tabActive]}
          onPress={() => setTab('orders')}
        >
          <MaterialCommunityIcons name="clipboard-list-outline" size={20} color={tab === 'orders' ? Brand.primary : Brand.textTertiary} />
          <Text style={[styles.tabText, tab === 'orders' && styles.tabTextActive]}>
            Orders ({orders.length})
          </Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="alert-circle" size={16} color={Brand.danger} />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      {/* ── Stats row ──────────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{activeProducts.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{products.length - activeProducts.length}</Text>
          <Text style={styles.statLabel}>Inactive</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{orders.filter((o) => o.status === 'pending').length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{orders.filter((o) => o.status === 'processing').length}</Text>
          <Text style={styles.statLabel}>Processing</Text>
        </View>
      </View>

      {/* ── Content ────────────────────────────────────────────── */}
      {tab === 'inventory' ? (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProduct}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="package-variant" size={48} color={Brand.textTertiary} />
              <Text style={styles.emptyText}>No products yet</Text>
              <Text style={styles.emptySub}>Use the web dashboard to add products</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={48} color={Brand.textTertiary} />
              <Text style={styles.emptyText}>No pending orders</Text>
              <Text style={styles.emptySub}>All caught up!</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { marginTop: 8, color: Brand.textSecondary, fontSize: 14 },

  // ── Tab bar ────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    paddingHorizontal: 12, paddingTop: 8, gap: 8,
    borderBottomWidth: 1, borderBottomColor: Brand.borderLight,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  tabActive: { backgroundColor: Brand.surfaceAlt },
  tabText: { fontSize: 13, fontWeight: '600', color: Brand.textTertiary },
  tabTextActive: { color: Brand.primary, fontWeight: '700' },

  // ── Stats row ──────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 12,
  },
  statPill: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, alignItems: 'center',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  statValue: { fontSize: 18, fontWeight: '800', color: Brand.text },
  statLabel: { fontSize: 10, color: Brand.textSecondary, fontWeight: '600', marginTop: 2 },

  // ── Error banner ───────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(220,38,38,0.08)', marginHorizontal: 12,
    padding: 10, borderRadius: 8,
  },
  errorBannerText: { fontSize: 12, color: Brand.danger, fontWeight: '600', flex: 1 },

  // ── List ───────────────────────────────────────────────────────
  listContent: { paddingHorizontal: 12, paddingBottom: 32 },

  // ── Product card ───────────────────────────────────────────────
  productCard: {
    flexDirection: 'row', gap: 12, backgroundColor: '#FFFFFF',
    borderRadius: 14, padding: 14, marginBottom: 10,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  productImageWrap: { width: 60, height: 60, borderRadius: 10, overflow: 'hidden' },
  productImage: { width: '100%', height: '100%' },
  productImageFallback: {
    width: '100%', height: '100%', backgroundColor: Brand.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  productInfo: { flex: 1, gap: 4 },
  productName: { fontSize: 14, fontWeight: '700', color: Brand.text },
  productPrice: { fontSize: 14, fontWeight: '800', color: Brand.primary },
  productMetaRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  stockIn: { backgroundColor: 'rgba(50,199,0,0.15)' },
  stockOut: { backgroundColor: 'rgba(220,38,38,0.15)' },
  stockBadgeText: { fontSize: 10, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusActive: { backgroundColor: 'rgba(50,199,0,0.15)' },
  statusInactive: { backgroundColor: 'rgba(220,38,38,0.15)' },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: Brand.text },

  // ── Order card ──────────────────────────────────────────────────
  orderCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderNumber: { fontSize: 15, fontWeight: '800', color: Brand.text },
  orderStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  status_pending: { backgroundColor: 'rgba(245,158,11,0.15)' },
  status_accepted: { backgroundColor: 'rgba(59,130,246,0.15)' },
  status_processing: { backgroundColor: 'rgba(50,199,0,0.15)' },
  status_shipped: { backgroundColor: 'rgba(139,92,246,0.15)' },
  status_delivered: { backgroundColor: 'rgba(50,199,0,0.2)' },
  status_cancelled: { backgroundColor: 'rgba(220,38,38,0.15)' },
  orderStatusText: { fontSize: 11, fontWeight: '700', color: Brand.text },
  orderMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  orderMetaText: { fontSize: 12, color: Brand.textSecondary },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, marginTop: 12, paddingVertical: 12, borderRadius: 10,
  },
  confirmBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  // ── Empty state ────────────────────────────────────────────────
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
});
