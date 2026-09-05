import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { getMyProducts } from '@/services/seller';

export default function SellerProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getMyProducts();
      setProducts(data);
    } catch (e: any) {
      console.error('Seller products error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      {item.primary_image_url ? (
        <Image source={{ uri: item.primary_image_url }} style={styles.productImage} contentFit="cover" />
      ) : (
        <View style={styles.productImageFallback}>
          <MaterialCommunityIcons name="package-variant" size={28} color="#9CA3AF" />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.productPrice}>UGX {Number(item.final_price).toLocaleString()}</Text>
        <View style={styles.productMeta}>
          <View style={[styles.statusDot, { backgroundColor: item.is_active ? '#16A34A' : '#9CA3AF' }]} />
          <Text style={styles.productStatus}>{item.is_active ? 'Active' : 'Inactive'}</Text>
          <Text style={styles.stockText}> · {item.stock_quantity} in stock</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={['#ff5a00', '#ff6a00', '#ff8520']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>My Products</Text>
          <Pressable hitSlop={12}>
            <MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>

        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        ) : products.length === 0 ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="package-variant" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No products yet</Text>
          </View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(item) => `${item.id}`}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  safeArea: { flex: 1, backgroundColor: '#ff6a00' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 14, color: '#6B7280' },
  list: { padding: 12, gap: 10 },
  card: {
    flexDirection: 'row', gap: 12, backgroundColor: '#FFFFFF',
    borderRadius: 14, padding: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  productImage: { width: 70, height: 70, borderRadius: 10 },
  productImageFallback: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  productInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  productName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  productPrice: { fontSize: 14, fontWeight: '700', color: Brand.primary },
  productMeta: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  productStatus: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  stockText: { fontSize: 12, color: '#9CA3AF' },
});



