import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { fetchWishlist, removeFromWishlist } from '@/services/wishlist';
import type { WishlistItem } from '@/types';

export default function BuyerWishlistScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      setError(null);
      const data = await fetchWishlist();
      setItems(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (id: number) => {
    try {
      await removeFromWishlist(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e: any) {
      console.error('Remove wishlist error:', e?.message);
    }
  };

  const renderItem = ({ item }: { item: WishlistItem }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      onPress={() => router.push(`/product/${item.product.slug}` as any)}
    >
      <View style={styles.imageWrap}>
        {item.product.primary_image_url ? (
          <Image source={{ uri: item.product.primary_image_url }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={styles.noImage}>
            <MaterialCommunityIcons name="image-outline" size={32} color={Brand.textTertiary} />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={2}>{item.product.name}</Text>
        <Text style={styles.price}>{item.product.currency} {Number(item.product.final_price).toLocaleString()}</Text>
      </View>
      <Pressable style={styles.removeBtn} onPress={() => handleRemove(item.id)} hitSlop={12}>
        <MaterialCommunityIcons name="heart" size={22} color={Brand.danger} />
      </Pressable>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.primaryDark, Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Wishlist ({items.length})</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

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
        ) : items.length === 0 ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="heart-outline" size={56} color={Brand.textTertiary} />
            <Text style={styles.title}>Your wishlist is empty</Text>
            <Text style={styles.subtitle}>Save products you love by tapping the heart icon</Text>
            <Pressable style={styles.shopBtn} onPress={() => router.push('/')}>
              <Text style={styles.shopBtnText}>Browse Products</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            maxToRenderPerBatch={8}
            windowSize={9}
            initialNumToRender={8}
            removeClippedSubviews={true}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Brand.primary]} tintColor={Brand.primary} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  title: { marginTop: 16, fontSize: 18, fontWeight: '700', color: Brand.text },
  subtitle: { marginTop: 8, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  shopBtn: { marginTop: 20, backgroundColor: Brand.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  shopBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  list: { padding: Spacing.two, gap: Spacing.two },
  card: { flexDirection: 'row', backgroundColor: Brand.surface, borderRadius: 12, padding: Spacing.two, gap: Spacing.two, alignItems: 'center', borderWidth: 1, borderColor: Brand.borderLight },
  imageWrap: { width: 60, height: 60, borderRadius: 8, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  noImage: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.surfaceAlt },
  cardBody: { flex: 1, gap: 4 },
  name: { fontSize: 14, fontWeight: '600', color: Brand.text },
  price: { fontSize: 14, fontWeight: '700', color: Brand.primary },
  removeBtn: { padding: Spacing.one },
});
