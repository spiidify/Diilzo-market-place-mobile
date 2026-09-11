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

import { ModernHeader } from '@/components/ModernHeader';
import { Brand, Spacing } from '@/constants/theme';
import { fetchOrders } from '@/services/orders';
import type { OrderItem } from '@/types';

// A single product line-item from a delivered order that the buyer can review.
interface ReviewableItem {
  key: string;
  order_id: number;
  order_number: string;
  item: OrderItem;
  created_at: string;
}

export default function BuyerReviewsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ReviewableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const orders = await fetchOrders();
      // Only delivered orders are eligible for reviews.
      const delivered = orders.filter((o) => o.status === 'delivered');
      const reviewable: ReviewableItem[] = [];
      for (const order of delivered) {
        for (const sub of order.suborders || []) {
          for (const item of sub.items || []) {
            reviewable.push({
              key: `${order.id}-${item.id}`,
              order_id: order.id,
              order_number: order.order_number,
              item,
              created_at: order.created_at,
            });
          }
        }
      }
      setItems(reviewable);
    } catch (e: any) {
      console.error('Buyer reviews error:', e?.message);
      setError(e?.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: ReviewableItem }) => {
    const img = item.item.product_image_url || item.item.product_image;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.imageWrap}>
            {img ? (
              <Image source={{ uri: img }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={styles.noImage}>
                <MaterialCommunityIcons name="image-outline" size={28} color={Brand.textTertiary} />
              </View>
            )}
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.name} numberOfLines={2}>{item.item.product_name}</Text>
            <Text style={styles.orderRef}>Order #{item.order_number}</Text>
            <Text style={styles.dateText}>
              Delivered {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.reviewBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push(`/product/${item.item.product_slug}` as any)}
        >
          <MaterialCommunityIcons name="pencil-outline" size={18} color="#FFFFFF" />
          <Text style={styles.reviewBtnText}>Write Review</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="My Reviews" subtitle="Products you've reviewed" />

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorTitle}>Couldn't load reviews</Text>
            <Text style={styles.errorSub}>{error}</Text>
            <Pressable style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]} onPress={load}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="star-outline" size={56} color={Brand.textTertiary} />
            <Text style={styles.title}>No reviews yet</Text>
            <Text style={styles.subtitle}>
              Products from your delivered orders will appear here for you to review.
            </Text>
            <Pressable style={({ pressed }) => [styles.shopBtn, pressed && { opacity: 0.85 }]} onPress={() => router.push('/buyer/orders' as any)}>
              <Text style={styles.shopBtnText}>View Orders</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            maxToRenderPerBatch={8}
            windowSize={9}
            initialNumToRender={8}
            removeClippedSubviews={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={load}
                colors={[Brand.primary]}
                tintColor={Brand.primary}
              />
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  title: { marginTop: 16, fontSize: 18, fontWeight: '700', color: Brand.text },
  subtitle: { marginTop: 8, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
  shopBtn: { marginTop: 20, backgroundColor: Brand.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  shopBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  errorTitle: { marginTop: 12, fontSize: 16, fontWeight: '700', color: Brand.danger },
  errorSub: { marginTop: 4, fontSize: 13, color: Brand.textTertiary, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  list: { padding: Spacing.three, gap: Spacing.two },
  card: {
    backgroundColor: Brand.surface, borderRadius: 14, padding: Spacing.three, gap: Spacing.two,
    borderWidth: 1, borderColor: Brand.borderLight,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  cardTop: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  imageWrap: { width: 64, height: 64, borderRadius: 10, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  noImage: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.surfaceAlt },
  cardBody: { flex: 1, gap: 3 },
  name: { fontSize: 14, fontWeight: '700', color: Brand.text },
  orderRef: { fontSize: 12, fontWeight: '600', color: Brand.textSecondary },
  dateText: { fontSize: 11, color: Brand.textTertiary },
  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Brand.primary, paddingVertical: 10, borderRadius: 10, marginTop: 4,
  },
  reviewBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
