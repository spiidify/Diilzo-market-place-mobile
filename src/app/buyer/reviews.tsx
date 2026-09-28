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
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      <View style={styles.row}>
        {img ? (
          <Image source={{ uri: img }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.noImage]}>
            <MaterialCommunityIcons name="image-outline" size={18} color={colors.textTertiary} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.item.product_name}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            Order #{item.order_number} · delivered {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.reviewBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push(`/product/${item.item.product_slug}` as any)}
          hitSlop={6}
        >
          <MaterialCommunityIcons name="pencil" size={14} color={Brand.primary} />
          <Text style={styles.reviewBtnText}>Review</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="My Reviews"
        subtitle={!loading && items.length > 0 ? `${items.length} item${items.length === 1 ? '' : 's'} to review` : undefined}
      />
      {loading ? (
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={44} color={Brand.danger} />
          <Text style={styles.errorTitle}>Couldn't load reviews</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <Pressable style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]} onPress={load}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="star-outline" size={48} color={colors.textTertiary} />
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
          style={styles.listCard}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
          maxToRenderPerBatch={12}
          windowSize={11}
          initialNumToRender={12}
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
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  title: { marginTop: 12, fontSize: 16, fontWeight: '700', color: c.text },
  subtitle: { marginTop: 6, fontSize: 13, color: c.textSecondary, textAlign: 'center' },
  shopBtn: { marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 10 },
  shopBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  errorTitle: { marginTop: 10, fontSize: 15, fontWeight: '700', color: Brand.danger },
  errorSub: { marginTop: 3, fontSize: 13, color: c.textTertiary, textAlign: 'center' },
  retryBtn: { marginTop: 14, backgroundColor: Brand.primary, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

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
  meta: { fontSize: 11, color: c.textTertiary, fontWeight: '500' },
  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Brand.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
  },
  reviewBtnText: { color: Brand.primary, fontWeight: '800', fontSize: 11 },
  rowDivider: { height: 1, backgroundColor: c.borderLight, marginLeft: 62 },
});
