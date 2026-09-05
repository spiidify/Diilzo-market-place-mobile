import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { fetchOrders } from '@/services/orders';
import type { Order } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  processing: '#3B82F6',
  shipped: '#8B5CF6',
  delivered: '#16A34A',
  cancelled: '#E2231A',
  refunded: '#6B7280',
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

  // ── Loading ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <LinearGradient
            colors={['#ff6a00', '#ff8520', '#ff9500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.topBar}
          >
            <View style={{ width: 24 }} />
            <Text style={styles.topBarTitle}>Account</Text>
            <View style={{ width: 24 }} />
          </LinearGradient>
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#ff6a00" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Not signed in ───────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <LinearGradient
            colors={['#ff6a00', '#ff8520', '#ff9500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.signInHero}
          >
            <View style={styles.signInIconWrap}>
              <MaterialCommunityIcons name="account-circle-outline" size={64} color="#FFFFFF" />
            </View>
            <Text style={styles.signInTitle}>Welcome to Diilzo</Text>
            <Text style={styles.signInSub}>
              Sign in to manage your account, orders, and wishlist.
            </Text>
          </LinearGradient>

          <View style={styles.signInActions}>
            <Pressable
              style={({ pressed }) => [styles.signInBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(auth)/login' as any)}
            >
              <Text style={styles.signInBtnText}>Sign In</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.registerBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(auth)/register' as any)}
            >
              <Text style={styles.registerBtnText}>Create Account</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const initial = (user?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase();
  const firstName = user?.first_name || user?.full_name?.split(' ')[0] || 'User';

  const menuItems = [
    { icon: 'view-dashboard-outline' as const, label: 'Dashboard', color: '#3B82F6', onPress: () => router.push('/') },
    { icon: 'message-outline' as const, label: 'Messages', color: '#16A34A', onPress: () => router.push('/chat' as any) },
    { icon: 'map-marker-outline' as const, label: 'My Addresses', color: '#8B5CF6', onPress: () => { } },
    { icon: 'heart-outline' as const, label: 'My Wishlist', color: '#E2231A', onPress: () => { } },
    { icon: 'bell-outline' as const, label: 'Notifications', color: '#F59E0B', onPress: () => { } },
    { icon: 'shopping-outline' as const, label: 'My Orders', color: '#16A34A', onPress: () => { } },
    { icon: 'store-outline' as const, label: 'Become a Seller', color: '#ff6a00', onPress: () => router.push('/suppliers' as any) },
    { icon: 'help-circle-outline' as const, label: 'Help & Support', color: '#6B7280', onPress: () => { } },
  ];

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ff6a00']} tintColor="#ff6a00" />
          }
        >
          {/* ── Profile hero with gradient ─────────────────────────── */}
          <LinearGradient
            colors={['#ff6a00', '#ff8520', '#ff9500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileHero}
          >
            <View style={styles.profileHeroContent}>
              {/* Profile picture */}
              <View style={styles.avatarWrap}>
                {user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                )}
                <View style={styles.editBadge}>
                  <MaterialCommunityIcons name="pencil" size={12} color="#FFFFFF" />
                </View>
              </View>
              {/* Name + email */}
              <Text style={styles.profileName}>{user?.full_name || firstName}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              {user?.phone ? (
                <View style={styles.phoneRow}>
                  <MaterialCommunityIcons name="phone-outline" size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.profilePhone}>{user.phone}</Text>
                </View>
              ) : null}
            </View>
          </LinearGradient>

          {/* ── Stats row ──────────────────────────────────────────── */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{orders.length}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Wishlist</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Addresses</Text>
            </View>
          </View>

          {/* ── Recent Orders ──────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="package-variant-closed" size={18} color="#ff6a00" />
              <Text style={styles.sectionTitle}>Recent Orders</Text>
            </View>
            {loadingOrders ? (
              <ActivityIndicator size="small" color="#ff6a00" style={{ padding: 20 }} />
            ) : orders.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="package-variant-closed" size={40} color="#D1D5DB" />
                <Text style={styles.emptyText}>No orders yet</Text>
                <Pressable style={styles.shopBtn} onPress={() => router.push('/')}>
                  <Text style={styles.shopBtnText}>Start Shopping</Text>
                </Pressable>
              </View>
            ) : (
              orders.slice(0, 3).map((order) => {
                const statusColor = STATUS_COLORS[order.status] || '#9CA3AF';
                return (
                  <Pressable
                    key={order.id}
                    style={({ pressed }) => [styles.orderCard, pressed && { opacity: 0.9 }]}
                    onPress={() => router.push(`/product/${order.suborders?.[0]?.items?.[0]?.product_slug || ''}`)}
                  >
                    <View style={styles.orderHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderNum}>#{order.order_number}</Text>
                        <Text style={styles.orderDate}>
                          {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {order.status}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.orderFooter}>
                      <Text style={styles.orderItems}>{order.total_items} items</Text>
                      <Text style={styles.orderTotal}>
                        {order.currency} {Number(order.total).toLocaleString()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>

          {/* ── Menu list ──────────────────────────────────────────── */}
          <View style={styles.menuSection}>
            {menuItems.map((item, idx) => (
              <Pressable
                key={idx}
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: '#F9FAFB' }]}
                onPress={item.onPress}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: item.color + '15' }]}>
                  <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={styles.menuText}>{item.label}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
              </Pressable>
            ))}
          </View>

          {/* ── Sign out ───────────────────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.85 }]}
            onPress={() => logout()}
          >
            <MaterialCommunityIcons name="logout" size={20} color="#FFFFFF" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>

          <View style={{ height: 20 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },

  // ── Top bar (loading) ───────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topBarTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Sign in hero ────────────────────────────────────────────────
  signInHero: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  signInIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  signInTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  signInSub: { fontSize: 14, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 20 },
  signInActions: { paddingHorizontal: 24, paddingTop: 24, gap: 12 },
  signInBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signInBtnText: { fontSize: 16, fontWeight: '700', color: '#ff6a00' },
  registerBtn: {
    borderWidth: 2,
    borderColor: '#ff6a00',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  registerBtnText: { fontSize: 16, fontWeight: '700', color: '#ff6a00' },

  // ── Scroll ──────────────────────────────────────────────────────
  scrollContent: { paddingBottom: 20 },

  // ── Profile hero ────────────────────────────────────────────────
  profileHero: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  profileHeroContent: { alignItems: 'center', gap: 6 },
  avatarWrap: { position: 'relative', marginBottom: 8 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarFallback: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#FFFFFF' },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileName: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  profileEmail: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  profilePhone: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },

  // ── Stats ───────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: -20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  statCard: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#1F2937' },
  statLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  statDivider: { width: 1, height: 32, backgroundColor: '#E5E7EB' },

  // ── Sections ────────────────────────────────────────────────────
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },

  // ── Orders ──────────────────────────────────────────────────────
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 28,
    gap: 10,
  },
  emptyText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  shopBtn: {
    backgroundColor: '#FFF3E8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff6a00',
    marginTop: 4,
  },
  shopBtnText: { fontSize: 13, fontWeight: '700', color: '#ff6a00' },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  orderNum: { fontWeight: '700', fontSize: 14, color: '#1F2937' },
  orderDate: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F3F4F6',
  },
  orderItems: { fontSize: 12, color: '#6B7280' },
  orderTotal: { fontSize: 14, fontWeight: '700', color: '#ff6a00' },

  // ── Menu ────────────────────────────────────────────────────────
  menuSection: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1F2937' },

  // ── Sign out ────────────────────────────────────────────────────
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#E2231A',
    borderRadius: 12,
    paddingVertical: 16,
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
