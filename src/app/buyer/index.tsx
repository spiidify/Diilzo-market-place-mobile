import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function BuyerDashboardScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

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

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.primary, Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>My Account</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <View style={styles.body}>
          {/* Profile hero */}
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              {isAuthenticated && user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarFallback}>
                  <MaterialCommunityIcons name="account" size={32} color="#FFFFFF" />
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {isAuthenticated ? (user?.full_name || user?.first_name || 'Buyer') : 'Guest User'}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {isAuthenticated ? user?.email : 'Sign in to access all features'}
              </Text>
              <View style={styles.buyerBadge}>
                <MaterialCommunityIcons name="shopping" size={12} color="#FFFFFF" />
                <Text style={styles.buyerBadgeText}>Buyer</Text>
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
                <MaterialCommunityIcons name="store-plus" size={26} color="#FFFFFF" />
              </View>
              <View style={styles.sellerCtaInfo}>
                <Text style={styles.sellerCtaTitle}>Become a Seller</Text>
                <Text style={styles.sellerCtaSub}>Start selling on Diilzo today</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#FFFFFF" />
            </Pressable>
          )}

          {/* Switch to seller dashboard */}
          {user?.has_store && (
            <Pressable
              style={({ pressed }) => [styles.switchCta, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/seller' as any)}
            >
              <View style={styles.switchCtaIcon}>
                <MaterialCommunityIcons name="store" size={24} color={Brand.primary} />
              </View>
              <View style={styles.switchCtaInfo}>
                <Text style={styles.switchCtaTitle}>Switch to Seller Dashboard</Text>
                <Text style={styles.switchCtaSub}>Manage your store and products</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={Brand.textTertiary} />
            </Pressable>
          )}

          {/* Menu items */}
          <View style={styles.menuSection}>
            {menuItems.map((item, index) => (
              <Pressable
                key={`buyer-menu-${index}`}
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: Brand.surfaceAlt }]}
                onPress={() => router.push(item.route)}
              >
                <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={22} color={item.color} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color={Brand.textTertiary} />
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  body: { flex: 1 },

  // Profile card
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', marginHorizontal: 12, marginTop: 12,
    padding: 18, borderRadius: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  avatarWrap: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: { width: '100%', height: '100%', backgroundColor: Brand.primary, justifyContent: 'center', alignItems: 'center' },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 18, fontWeight: '700', color: Brand.text },
  profileEmail: { fontSize: 13, color: Brand.textTertiary },
  buyerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#3B82F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start',
  },
  buyerBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  // Seller CTA
  sellerCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Brand.primary, marginHorizontal: 12, marginTop: 12,
    padding: 18, borderRadius: 16,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  sellerCtaIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  sellerCtaInfo: { flex: 1, gap: 2 },
  sellerCtaTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  sellerCtaSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },

  // Switch to seller
  switchCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', marginHorizontal: 12, marginTop: 12,
    padding: 16, borderRadius: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  switchCtaIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Brand.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  switchCtaInfo: { flex: 1, gap: 2 },
  switchCtaTitle: { fontSize: 15, fontWeight: '700', color: Brand.text },
  switchCtaSub: { fontSize: 13, color: Brand.textTertiary },

  // Menu
  menuSection: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 32 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 12, marginBottom: 8,
  },
  menuIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Brand.text },
});



