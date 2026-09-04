import { useEffect, useState, useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { fetchProducts } from '@/services/products';
import { BASE_URL } from '@/services/api';
import type { Product } from '@/types';

export default function ProductFeedScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadProducts = useCallback(async (reset = false) => {
    const targetPage = reset ? 1 : page;
    if (reset) {
      setPage(1);
      setHasMore(true);
    }
    try {
      if (reset) {
        setRefreshing(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      const data = await fetchProducts({ page: targetPage });
      setProducts((prev) => (reset ? data.results : [...prev, ...data.results]));
      setHasMore(data.next !== null);
      if (!reset) setPage(targetPage + 1);
    } catch (e: any) {
      setError(e?.message || 'Failed to load products');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [page]);

  useEffect(() => {
    loadProducts(true);
  }, []);

  const onRefresh = useCallback(() => loadProducts(true), [loadProducts]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || refreshing) return;
    loadProducts(false);
  }, [hasMore, loadingMore, refreshing, loadProducts]);

  const renderProduct = ({ item }: { item: Product }) => (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/product/${item.slug}`)}
    >
      <ThemedView type="backgroundElement" style={styles.imageWrap}>
        {item.primary_image_url ? (
          <Image
            source={{ uri: item.primary_image_url }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <ThemedView type="backgroundElement" style={styles.noImage}>
            <ThemedText type="small">No image</ThemedText>
          </ThemedView>
        )}
      </ThemedView>
      <ThemedView style={styles.cardBody}>
        <ThemedText type="default" style={styles.name} numberOfLines={2}>
          {item.name}
        </ThemedText>
        {item.store && (
          <ThemedText type="small" style={styles.store}>
            {item.store.name}
          </ThemedText>
        )}
        <ThemedView style={styles.priceRow}>
          <ThemedText type="small" style={styles.currency}>{item.currency}</ThemedText>
          <ThemedText type="title" style={styles.price}>
            {Number(item.final_price).toLocaleString()}
          </ThemedText>
        </ThemedView>
        {item.is_on_sale && (
          <ThemedText type="small" style={styles.discount}>
            -{item.discount_percentage}% OFF
          </ThemedText>
        )}
      </ThemedView>
    </Pressable>
  );

  if (loading && products.length === 0) {
    return (
      <ThemedView style={styles.centerContainer}>
        <SafeAreaView style={styles.safeArea}>
          <ActivityIndicator size="large" color="#ff6a00" />
          <ThemedText type="small" style={styles.loadingText}>Loading products…</ThemedText>
          <ThemedText type="small" style={styles.apiUrl}>API: {BASE_URL}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (error && products.length === 0) {
    return (
      <ThemedView style={styles.centerContainer}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title" style={styles.errorTitle}>Connection Error</ThemedText>
          <ThemedText type="small" style={styles.errorMsg}>{error}</ThemedText>
          <ThemedText type="small" style={styles.apiUrl}>API: {BASE_URL}</ThemedText>
          <Pressable style={styles.retryBtn} onPress={() => loadProducts(true)}>
            <ThemedText type="small" style={styles.retryText}>Retry</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Diilzo</ThemedText>
          <ThemedText type="small" style={styles.subtitle}>
            {products.length} products loaded
          </ThemedText>
        </ThemedView>
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ff6a00']} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color="#ff6a00" style={styles.footer} />
            ) : !hasMore ? (
              <ThemedText type="small" style={styles.endText}>No more products</ThemedText>
            ) : null
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  subtitle: { marginTop: 2, opacity: 0.6 },
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
  currency: { fontSize: 11, color: '#ff6a00', opacity: 0.8 },
  price: { fontSize: 16, fontWeight: '700', color: '#ff6a00' },
  discount: { color: '#e2231a', fontSize: 11, fontWeight: '600', marginTop: 2 },
  loadingText: { marginTop: Spacing.two, opacity: 0.6 },
  apiUrl: { marginTop: Spacing.one, fontSize: 10, opacity: 0.4 },
  errorTitle: { marginBottom: Spacing.two, color: '#e2231a' },
  errorMsg: { textAlign: 'center', paddingHorizontal: Spacing.four, opacity: 0.7 },
  retryBtn: {
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    backgroundColor: '#ff6a00',
  },
  retryText: { color: '#fff', fontWeight: '600' },
  footer: { paddingVertical: Spacing.three },
  endText: { textAlign: 'center', paddingVertical: Spacing.three, opacity: 0.4 },
});
