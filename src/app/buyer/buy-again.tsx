import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { addToCart } from '@/services/cart';
import { fetchBuyAgain } from '@/services/connection';
import { playSound, Sounds } from '@/services/sound';
import type { Product } from '@/types';

export default function BuyAgainScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await fetchBuyAgain();
      setProducts(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load products');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBuyAgain = async (product: Product) => {
    try {
      await addToCart(product.id, 1);
      playSound(Sounds.ADD_TO_CART);
    } catch (e) {
      // ignore
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/product/${item.slug}` as any)}
    >
      {item.images?.[0]?.image ? (
        <Image source={{ uri: item.images[0].image }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <MaterialCommunityIcons name="image-off" size={24} color={Brand.textTertiary} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.price}>{item.price_display || `${item.price} UGX`}</Text>
        <Pressable style={styles.buyAgainBtn} onPress={() => handleBuyAgain(item)}>
          <MaterialCommunityIcons name="cart-plus" size={16} color="#fff" />
          <Text style={styles.buyAgainText}>Buy Again</Text>
        </Pressable>
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Brand.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Buy Again</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Brand.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Buy Again</Text>
        <View style={{ width: 24 }} />
      </View>
      {error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.centerContent}>
          <MaterialCommunityIcons name="history" size={48} color={Brand.textTertiary} />
          <Text style={styles.emptyTitle}>No previous purchases</Text>
          <Text style={styles.emptySubtitle}>Products you've ordered will appear here for quick repurchase</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item: any) => String(item.id)}
          numColumns={2}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    borderBottomWidth: 1, borderBottomColor: Brand.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Brand.text },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  list: { padding: Spacing.two },
  card: {
    flex: 1, margin: Spacing.one, backgroundColor: Brand.surface,
    borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: Brand.border,
  },
  image: { width: '100%', height: 140, resizeMode: 'cover' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.border },
  cardBody: { padding: Spacing.two },
  name: { fontSize: 13, fontWeight: '600', color: Brand.text, marginBottom: 4 },
  price: { fontSize: 14, fontWeight: '700', color: Brand.primary, marginBottom: 8 },
  buyAgainBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Brand.primary, paddingVertical: 8, borderRadius: 8,
  },
  buyAgainText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  errorText: { fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: Brand.primary, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Brand.text, marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: Brand.textSecondary, marginTop: 4, textAlign: 'center' },
});
