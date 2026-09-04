import { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet, FlatList, RefreshControl, ActivityIndicator, Pressable, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { fetchProducts, searchProducts } from '@/services/products';
import type { Product } from '@/types';

const ORANGE = '#ff6a00';

export default function SearchScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (reset = false) => {
    const targetPage = reset ? 1 : page;
    if (reset) { setPage(1); setHasMore(true); }
    try {
      if (reset) setRefreshing(true); else setLoadingMore(true);
      const data = query
        ? await searchProducts(query, targetPage)
        : await fetchProducts({ page: targetPage });
      setProducts((prev) => (reset ? data.results : [...prev, ...data.results]));
      setHasMore(data.next !== null);
      if (!reset) setPage(targetPage + 1);
    } catch (e: any) {
      console.error('Search load error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [page, query]);

  useEffect(() => { load(true); }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => load(true), 400);
    return () => clearTimeout(t);
  }, [query]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || refreshing) return;
    load(false);
  }, [hasMore, loadingMore, refreshing, load]);

  const renderProduct = ({ item }: { item: Product }) => (
    <Pressable style={styles.card} onPress={() => router.push(`/product/${item.slug}`)}>
      <ThemedView type="backgroundElement" style={styles.imageWrap}>
        {item.primary_image_url ? (
          <Image source={{ uri: item.primary_image_url }} style={styles.image} contentFit="cover" transition={200} />
        ) : (
          <ThemedView type="backgroundElement" style={styles.noImage}>
            <ThemedText type="small">No image</ThemedText>
          </ThemedView>
        )}
      </ThemedView>
      <ThemedView style={styles.cardBody}>
        <ThemedText type="default" style={styles.name} numberOfLines={2}>{item.name}</ThemedText>
        {item.store && <ThemedText type="small" style={styles.store}>{item.store.name}</ThemedText>}
        <ThemedView style={styles.priceRow}>
          <ThemedText type="small" style={styles.currency}>{item.currency}</ThemedText>
          <ThemedText type="title" style={styles.price}>{Number(item.final_price).toLocaleString()}</ThemedText>
        </ThemedView>
      </ThemedView>
    </Pressable>
  );

  if (loading && products.length === 0) {
    return (
      <ThemedView style={styles.center}>
        <SafeAreaView style={styles.safeArea}>
          <ActivityIndicator size="large" color={ORANGE} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search products…"
            placeholderTextColor="#999"
            autoCapitalize="none"
          />
        </ThemedView>
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[ORANGE]} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator size="small" color={ORANGE} style={{ padding: 16 }} />
            : !hasMore ? <ThemedText type="small" style={styles.endText}>No more products</ThemedText>
            : null
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  searchInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
    backgroundColor: '#fff', color: '#333',
  },
  list: { paddingHorizontal: Spacing.two, paddingBottom: Spacing.five },
  row: { gap: Spacing.two, marginBottom: Spacing.two },
  card: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  imageWrap: { borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', height: 180 },
  noImage: { width: '100%', height: 180, justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: Spacing.two, gap: 2 },
  name: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  store: { opacity: 0.55, fontSize: 11 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  currency: { fontSize: 11, color: ORANGE, opacity: 0.8 },
  price: { fontSize: 16, fontWeight: '700', color: ORANGE },
  endText: { textAlign: 'center', paddingVertical: Spacing.three, opacity: 0.4 },
});
