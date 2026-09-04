import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { fetchOrders } from '@/services/orders';
import type { Order } from '@/types';

const ORANGE = '#ff6a00';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  processing: '#3b82f6',
  shipped: '#8b5cf6',
  delivered: '#16a34a',
  cancelled: '#e2231a',
  refunded: '#6b7280',
};

export default function AccountScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingOrders(true);
      const data = await fetchOrders();
      setOrders(data);
    } catch (e: any) {
      console.error('Orders load error:', e?.message);
    } finally {
      setLoadingOrders(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.center}>
        <SafeAreaView style={styles.safeArea}>
          <ActivityIndicator size="large" color={ORANGE} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!isAuthenticated) {
    return (
      <ThemedView style={styles.center}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title" style={styles.brand}>Diilzo</ThemedText>
          <ThemedText type="small" style={styles.subtitle}>Sign in to manage your account, orders, and wishlist.</ThemedText>
          <Pressable style={styles.btn} onPress={() => router.push('/(auth)/login')}>
            <ThemedText style={styles.btnText}>Sign In</ThemedText>
          </Pressable>
          <Pressable style={styles.btnOutline} onPress={() => router.push('/(auth)/register')}>
            <ThemedText style={styles.btnOutlineText}>Create Account</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ORANGE]} />}
        >
          {/* Profile header */}
          <ThemedView style={styles.profileHeader}>
            <ThemedView style={styles.avatar}>
              <ThemedText type="title" style={styles.avatarText}>
                {(user?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.profileInfo}>
              <ThemedText type="title" style={styles.profileName}>{user?.full_name || 'User'}</ThemedText>
              <ThemedText type="small" style={styles.profileEmail}>{user?.email}</ThemedText>
              {user?.phone ? <ThemedText type="small" style={styles.profilePhone}>{user.phone}</ThemedText> : null}
            </ThemedView>
          </ThemedView>

          {/* Quick stats */}
          <ThemedView style={styles.statsRow}>
            <ThemedView style={styles.stat}>
              <ThemedText type="title" style={styles.statValue}>{orders.length}</ThemedText>
              <ThemedText type="small" style={styles.statLabel}>Orders</ThemedText>
            </ThemedView>
            <ThemedView style={styles.stat}>
              <ThemedText type="title" style={styles.statValue}>0</ThemedText>
              <ThemedText type="small" style={styles.statLabel}>Wishlist</ThemedText>
            </ThemedView>
            <ThemedView style={styles.stat}>
              <ThemedText type="title" style={styles.statValue}>0</ThemedText>
              <ThemedText type="small" style={styles.statLabel}>Addresses</ThemedText>
            </ThemedView>
          </ThemedView>

          {/* Recent Orders */}
          <ThemedView style={styles.section}>
            <ThemedText type="default" style={styles.sectionTitle}>Recent Orders</ThemedText>
            {loadingOrders ? (
              <ActivityIndicator size="small" color={ORANGE} style={{ padding: 20 }} />
            ) : orders.length === 0 ? (
              <ThemedText type="small" style={styles.emptyText}>No orders yet.</ThemedText>
            ) : (
              orders.slice(0, 5).map((order) => (
                <Pressable
                  key={order.id}
                  style={styles.orderRow}
                  onPress={() => router.push(`/product/${order.suborders?.[0]?.items?.[0]?.product_slug || ''}`)}
                >
                  <ThemedView style={styles.orderInfo}>
                    <ThemedText type="default" style={styles.orderNum}>#{order.order_number}</ThemedText>
                    <ThemedText type="small" style={styles.orderDate}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.orderRight}>
                    <ThemedText type="small" style={styles.orderItems}>{order.total_items} items</ThemedText>
                    <ThemedText type="default" style={styles.orderTotal}>
                      {order.currency} {Number(order.total).toLocaleString()}
                    </ThemedText>
                    <ThemedView style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[order.status] || '#999') + '20' }]}>
                      <ThemedText type="small" style={[styles.statusText, { color: STATUS_COLORS[order.status] || '#999' }]}>
                        {order.status}
                      </ThemedText>
                    </ThemedView>
                  </ThemedView>
                </Pressable>
              ))
            )}
          </ThemedView>

          {/* Menu */}
          <ThemedView style={styles.section}>
            <Pressable style={styles.menuItem}><ThemedText type="default">My Addresses</ThemedText></Pressable>
            <Pressable style={styles.menuItem}><ThemedText type="default">My Wishlist</ThemedText></Pressable>
            <Pressable style={styles.menuItem}><ThemedText type="default">Notifications</ThemedText></Pressable>
            <Pressable style={styles.menuItem}><ThemedText type="default">Help & Support</ThemedText></Pressable>
            <Pressable style={styles.menuItem} onPress={() => logout()}>
              <ThemedText type="default" style={styles.logoutText}>Sign Out</ThemedText>
            </Pressable>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.three, paddingBottom: 40 },
  brand: { fontSize: 32, fontWeight: '800', color: ORANGE, marginBottom: 8 },
  subtitle: { opacity: 0.5, textAlign: 'center', marginBottom: 24, paddingHorizontal: 20 },
  btn: { backgroundColor: ORANGE, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', marginBottom: 12, width: '80%' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnOutline: { borderWidth: 1, borderColor: ORANGE, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', width: '80%' },
  btnOutlineText: { color: ORANGE, fontWeight: '700', fontSize: 16 },
  profileHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 20 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700' },
  profileEmail: { opacity: 0.5, fontSize: 13 },
  profilePhone: { opacity: 0.4, fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  statValue: { fontSize: 20, fontWeight: '700', color: ORANGE },
  statLabel: { opacity: 0.5, fontSize: 11, marginTop: 2 },
  section: { marginBottom: 20, gap: 4 },
  sectionTitle: { fontWeight: '700', fontSize: 15, marginBottom: 8, opacity: 0.7 },
  emptyText: { opacity: 0.4, paddingVertical: 12 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  orderInfo: { flex: 1 },
  orderNum: { fontWeight: '600', fontSize: 14 },
  orderDate: { opacity: 0.4, fontSize: 11, marginTop: 2 },
  orderRight: { alignItems: 'flex-end', gap: 2 },
  orderItems: { opacity: 0.5, fontSize: 11 },
  orderTotal: { fontWeight: '700', fontSize: 14, color: ORANGE },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  statusText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  menuItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  logoutText: { color: '#e2231a', fontWeight: '600' },
});
