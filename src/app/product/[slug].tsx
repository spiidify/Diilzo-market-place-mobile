import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { fetchProductBySlug } from '@/services/products';
import type { Product } from '@/types';

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProductBySlug(slug);
      setProduct(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <SafeAreaView style={styles.safeArea}>
          <ActivityIndicator size="large" color="#ff6a00" />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (error || !product) {
    return (
      <ThemedView style={styles.center}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title" style={styles.error}>{error || 'Product not found'}</ThemedText>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ThemedText type="small" style={styles.backText}>Go back</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {product.primary_image_url && (
            <Image
              source={{ uri: product.primary_image_url }}
              style={styles.heroImage}
              contentFit="cover"
            />
          )}
          <ThemedView style={styles.body}>
            <ThemedText type="title" style={styles.name}>{product.name}</ThemedText>
            {product.store && (
              <ThemedText type="small" style={styles.store}>{product.store.name}</ThemedText>
            )}
            <ThemedView style={styles.priceRow}>
              <ThemedText type="small" style={styles.currency}>{product.currency}</ThemedText>
              <ThemedText type="title" style={styles.price}>
                {Number(product.final_price).toLocaleString()}
              </ThemedText>
              {product.is_on_sale && (
                <ThemedText type="small" style={styles.oldPrice}>
                  {Number(product.price).toLocaleString()}
                </ThemedText>
              )}
            </ThemedView>
            {product.short_description ? (
              <ThemedText type="default" style={styles.desc}>{product.short_description}</ThemedText>
            ) : null}
            <ThemedText type="small" style={styles.meta}>
              Stock: {product.stock_quantity} · {product.is_in_stock ? 'In stock' : 'Out of stock'}
            </ThemedText>
            {product.is_wholesale && (
              <ThemedText type="small" style={styles.wholesale}>
                Min order: {product.min_order_quantity} units
              </ThemedText>
            )}
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
  scroll: { paddingBottom: Spacing.five },
  heroImage: { width: '100%', height: 360 },
  body: { padding: Spacing.three, gap: Spacing.two },
  name: { fontSize: 22, fontWeight: '700' },
  store: { opacity: 0.6, fontSize: 13 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: Spacing.one },
  currency: { fontSize: 14, color: '#ff6a00', opacity: 0.8 },
  price: { fontSize: 24, fontWeight: '700', color: '#ff6a00' },
  oldPrice: { fontSize: 14, opacity: 0.4, textDecorationLine: 'line-through' },
  desc: { fontSize: 14, lineHeight: 20, opacity: 0.8 },
  meta: { opacity: 0.5, marginTop: Spacing.one },
  wholesale: { color: '#f59e0b', fontWeight: '600', marginTop: 4 },
  error: { color: '#e2231a', textAlign: 'center' },
  backBtn: { marginTop: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, backgroundColor: '#ff6a00', borderRadius: 8 },
  backText: { color: '#fff', fontWeight: '600' },
});
