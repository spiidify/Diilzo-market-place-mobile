import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { GradientHeader } from '@/components/GradientHeader';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { addToCart } from '@/services/cart';
import { fetchBuyAgain } from '@/services/connection';
import { playSound, Sounds } from '@/services/sound';
import type { Product } from '@/types';

export default function BuyAgainScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);

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
      setAdding(product.id);
      await addToCart(product.id, 1);
      playSound(Sounds.ADD_TO_CART);
    } catch (e) {
      // ignore
    } finally {
      setAdding(null);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
      onPress={() => router.push(`/product/${item.slug}` as any)}
    >
      {item.images?.[0]?.image ? (
        <Image source={{ uri: item.images[0].image }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <MaterialCommunityIcons name="image-outline" size={18} color={colors.textTertiary} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.price}>{item.price_display || `${Number(item.price).toLocaleString()} UGX`}</Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
        onPress={() => handleBuyAgain(item)}
        disabled={adding === item.id}
        hitSlop={6}
      >
        {adding === item.id ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <MaterialCommunityIcons name="cart-plus" size={14} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add</Text>
          </>
        )}
      </Pressable>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Buy Again"
        subtitle={!loading && products.length > 0 ? `${products.length} item${products.length === 1 ? '' : 's'}` : undefined}
      />
      {loading ? (
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={44} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="history" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No previous purchases</Text>
          <Text style={styles.emptySubtitle}>Products you've ordered will appear here for quick repurchase</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={renderItem}
          style={styles.listCard}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
          maxToRenderPerBatch={12}
          windowSize={11}
          initialNumToRender={12}
          removeClippedSubviews={true}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Brand.primary]} tintColor={Brand.primary} />}
        />
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  listCard: { flex: 1 },
  list: {
    margin: 10, borderRadius: 14, overflow: 'hidden',
    backgroundColor: c.surface,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  image: { width: 44, height: 44, borderRadius: 8 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 13, fontWeight: '700', color: c.text },
  price: { fontSize: 12, fontWeight: '800', color: Brand.primary },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Brand.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    minWidth: 62, justifyContent: 'center',
  },
  addBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  rowDivider: { height: 1, backgroundColor: c.borderLight, marginLeft: 62 },
  errorText: { fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 9, backgroundColor: Brand.primary, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginTop: 10 },
  emptySubtitle: { fontSize: 13, color: c.textSecondary, marginTop: 3, textAlign: 'center' },
});
