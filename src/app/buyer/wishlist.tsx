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
import { fetchWishlist, removeFromWishlist } from '@/services/wishlist';
import type { WishlistItem } from '@/types';

export default function BuyerWishlistScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
      onPress={() => router.push(`/product/${item.product.slug}` as any)}
    >
      {item.product.primary_image_url ? (
        <Image source={{ uri: item.product.primary_image_url }} style={styles.image} resizeMode="contain" />
      ) : (
        <View style={[styles.image, styles.noImage]}>
          <MaterialCommunityIcons name="image-outline" size={18} color={colors.textTertiary} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.product.name}</Text>
        <Text style={styles.price}>{item.product.currency} {Number(item.product.final_price).toLocaleString()}</Text>
      </View>
      <Pressable style={styles.removeBtn} onPress={() => handleRemove(item.id)} hitSlop={10}>
        <MaterialCommunityIcons name="heart" size={20} color={Brand.danger} />
      </Pressable>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Wishlist"
        subtitle={!loading && items.length > 0 ? `${items.length} item${items.length === 1 ? '' : 's'}` : undefined}
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
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="heart-outline" size={48} color={colors.textTertiary} />
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
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  title: { marginTop: 12, fontSize: 16, fontWeight: '700', color: c.text },
  subtitle: { marginTop: 6, fontSize: 13, color: c.textSecondary, textAlign: 'center' },
  errorText: { marginTop: 10, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  shopBtn: { marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 10 },
  shopBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

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
  noImage: { justifyContent: 'center', alignItems: 'center', backgroundColor: c.surfaceAlt },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 13, fontWeight: '700', color: c.text },
  price: { fontSize: 12, fontWeight: '800', color: Brand.primary },
  removeBtn: { padding: 6 },
  rowDivider: { height: 1, backgroundColor: c.borderLight, marginLeft: 62 },
});
