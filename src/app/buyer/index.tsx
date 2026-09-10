import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GradientHeader } from '@/components/GradientHeader';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function BuyerDashboardScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const menuItems = [
    { icon: 'shopping', label: 'My Orders', color: '#3B82F6', route: '/buyer/orders' as any },
    { icon: 'heart-outline', label: 'Wishlist', color: Brand.danger, route: '/buyer/wishlist' as any },
    { icon: 'map-marker-outline', label: 'Addresses', color: '#16A34A', route: '/buyer/addresses' as any },
    { icon: 'credit-card-outline', label: 'Payment Methods', color: '#8B5CF6', route: '/buyer/payments' as any },
    { icon: 'chat-outline', label: 'Messages', color: '#EC4899', route: '/chat' as any },
    { icon: 'bell-outline', label: 'Notifications', color: Brand.rating, route: '/buyer/notifications' as any },
    { icon: 'shield-account-outline', label: 'Privacy & Security', color: Brand.textSecondary, route: '/buyer/privacy' as any },
    { icon: 'help-circle-outline', label: 'Help & Support', color: '#06B6D4', route: '/buyer/support' as any },
  ];

  // Show loading while auth state is being determined
  if (isLoading) {
    return (
      <View style={styles.screen}>
        <GradientHeader title="My Dashboard" subtitle="Welcome back" showBack={false} />
        <View style={styles.loadingBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Not authenticated — show login prompt
  if (!isAuthenticated) {
    return (
      <View style={styles.screen}>
        <GradientHeader title="My Dashboard" subtitle="Welcome back" showBack={false} />
        <View style={styles.loginPromptBody}>
          <View style={styles.loginPromptIcon}>
            <MaterialCommunityIcons name="account-lock-outline" size={44} color={Brand.primary} />
          </View>
          <Text style={styles.loginPromptTitle}>Sign In Required</Text>
          <Text style={styles.loginPromptSub}>
            Please sign in to access your orders, wishlist, addresses, and account settings.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.loginBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/(auth)/login' as any)}
          >
            <MaterialCommunityIcons name="login" size={20} color="#FFFFFF" />
            <Text style={styles.loginBtnText}>Sign In</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.registerBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/(auth)/register' as any)}
          >
            <Text style={styles.registerBtnText}>Create a Free Account</Text>
          </Pressable>
          <Pressable onPress={() => router.replace('/')} hitSlop={12}>
            <Text style={styles.guestText}>Continue as guest</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <GradientHeader title="My Dashboard" subtitle="Welcome back" showBack={false} />

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={styles.bodyContent}>
        {/* Profile hero — card with avatar */}
        <View style={styles.profileCard}>
          <View style={styles.profileGradient}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarWrap}>
                {isAuthenticated && user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatar} resizeMode="cover" />
                ) : (
                  <View style={styles.avatarFallback}>
                    <MaterialCommunityIcons name="account" size={36} color="#FFFFFF" />
                  </View>
                )}
              </View>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {isAuthenticated ? (user?.full_name || user?.first_name || 'Buyer') : 'Guest User'}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {isAuthenticated ? user?.email : 'Sign in to access all features'}
              </Text>
              <View style={styles.buyerBadge}>
                <MaterialCommunityIcons name="shopping" size={11} color="#FFFFFF" />
                <Text style={styles.buyerBadgeText}>Buyer</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Become a seller CTA */}
        {!user?.has_store && (
          <Pressable
            style={({ pressed }) => [styles.sellerCta, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/seller' as any)}
          >
            <View style={styles.sellerCtaIcon}>
              <MaterialCommunityIcons name="store-plus" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.sellerCtaInfo}>
              <Text style={styles.sellerCtaTitle}>Become a Seller</Text>
              <Text style={styles.sellerCtaSub}>Start selling on Diilzo today</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#FFFFFF" />
          </Pressable>
        )}

        {/* Switch to seller dashboard */}
        {user?.has_store && (
          <Pressable
            style={({ pressed }) => [styles.switchCta, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/seller' as any)}
          >
            <View style={styles.switchCtaIcon}>
              <MaterialCommunityIcons name="store" size={22} color={Brand.primary} />
            </View>
            <View style={styles.switchCtaInfo}>
              <Text style={styles.switchCtaTitle}>Switch to Seller Dashboard</Text>
              <Text style={styles.switchCtaSub}>Manage your store and products</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Brand.textTertiary} />
          </Pressable>
        )}

        {/* Super Admin — all dashboards */}
        {user?.is_superuser && (
          <View style={styles.adminSection}>
            <Text style={styles.adminSectionTitle}>Admin Access</Text>
            <Pressable
              style={({ pressed }) => [styles.adminCta, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/seller' as any)}
            >
              <View style={[styles.adminCtaIcon, { backgroundColor: '#3B82F6' }]}>
                <MaterialCommunityIcons name="store-cog" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.adminCtaInfo}>
                <Text style={styles.adminCtaTitle}>Seller Dashboard</Text>
                <Text style={styles.adminCtaSub}>Manage all stores and products</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Brand.textTertiary} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.adminCta, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/merchant-studio' as any)}
            >
              <View style={[styles.adminCtaIcon, { backgroundColor: '#06B6D4' }]}>
                <MaterialCommunityIcons name="package-variant-closed" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.adminCtaInfo}>
                <Text style={styles.adminCtaTitle}>Merchant Studio</Text>
                <Text style={styles.adminCtaSub}>Inventory & order dispatch</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Brand.textTertiary} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.adminCta, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/adpulse' as any)}
            >
              <View style={[styles.adminCtaIcon, { backgroundColor: '#EC4899' }]}>
                <MaterialCommunityIcons name="rocket-launch" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.adminCtaInfo}>
                <Text style={styles.adminCtaTitle}>AdPulse Studio</Text>
                <Text style={styles.adminCtaSub}>Marketing & promotions</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Brand.textTertiary} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.adminCta, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/adminops' as any)}
            >
              <View style={[styles.adminCtaIcon, { backgroundColor: Brand.dark }]}>
                <MaterialCommunityIcons name="shield-crown-outline" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.adminCtaInfo}>
                <Text style={styles.adminCtaTitle}>AdminOps Central</Text>
                <Text style={styles.adminCtaSub}>Operations dashboard</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Brand.textTertiary} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.adminCta, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/admin' as any)}
            >
              <View style={[styles.adminCtaIcon, { backgroundColor: '#8B5CF6' }]}>
                <MaterialCommunityIcons name="view-dashboard" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.adminCtaInfo}>
                <Text style={styles.adminCtaTitle}>Admin Dashboard</Text>
                <Text style={styles.adminCtaSub}>Full platform management</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Brand.textTertiary} />
            </Pressable>
          </View>
        )}

        {/* Menu items — grouped in a single card with dividers */}
        <View style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <Pressable
              key={`buyer-menu-${index}`}
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: '#F8FAFB' }]}
              onPress={() => router.push(item.route)}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
                <MaterialCommunityIcons name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Brand.textTertiary} />
            </Pressable>
          ))}
        </View>

        {/* Logout */}
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.85 }]}
          onPress={async () => {
            await logout();
            router.replace('/');
          }}
        >
          <MaterialCommunityIcons name="logout" size={20} color={Brand.danger} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F2F4F6' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 40 },

  // Loading state
  loadingBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: Brand.textSecondary, fontSize: 14 },

  // Login prompt (not authenticated)
  loginPromptBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loginPromptIcon: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: Brand.primary + '12',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  loginPromptTitle: { fontSize: 21, fontWeight: '800', color: Brand.text },
  loginPromptSub: { fontSize: 14, color: Brand.textTertiary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  loginBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: 14, marginTop: 24, width: '100%',
  },
  loginBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  registerBtn: {
    borderWidth: 1.5, borderColor: Brand.primary, paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: 14, marginTop: 12, width: '100%', alignItems: 'center',
  },
  registerBtnText: { color: Brand.primary, fontSize: 15, fontWeight: '700' },
  guestText: { color: Brand.textTertiary, fontSize: 13, marginTop: 20 },

  // Profile card — hero
  profileCard: {
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: Brand.primary,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  profileGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 20,
    backgroundColor: Brand.primary,
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  avatarWrap: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  profileEmail: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  buyerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  buyerBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  // Seller CTA
  sellerCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Brand.primary, marginTop: 12,
    padding: 16, borderRadius: 16,
    elevation: 3, shadowColor: Brand.primary, shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  sellerCtaIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  sellerCtaInfo: { flex: 1, gap: 2 },
  sellerCtaTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  sellerCtaSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },

  // Switch to seller
  switchCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', marginTop: 12,
    padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#E8EDF0',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  switchCtaIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Brand.primary + '12', justifyContent: 'center', alignItems: 'center' },
  switchCtaInfo: { flex: 1, gap: 2 },
  switchCtaTitle: { fontSize: 15, fontWeight: '700', color: Brand.text },
  switchCtaSub: { fontSize: 13, color: Brand.textTertiary },

  // ── Super Admin section ──────────────────────────────────────────
  adminSection: { marginTop: 16, gap: 8 },
  adminSectionTitle: { fontSize: 13, fontWeight: '800', color: Brand.textSecondary, paddingHorizontal: 4, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  adminCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF',
    padding: 16, borderRadius: 14,
    borderWidth: 1, borderColor: '#E8EDF0',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  adminCtaIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  adminCtaInfo: { flex: 1, gap: 2 },
  adminCtaTitle: { fontSize: 14, fontWeight: '700', color: Brand.text },
  adminCtaSub: { fontSize: 12, color: Brand.textTertiary },

  // Menu — single grouped card with dividers
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 12,
    overflow: 'hidden',
    borderWidth: 1, borderColor: '#E8EDF0',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F2F4',
  },
  menuIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Brand.text },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFF', marginBottom: 32, marginTop: 12,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: Brand.danger + '25',
  },
  logoutText: { color: Brand.danger, fontSize: 15, fontWeight: '700' },
});
