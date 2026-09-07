import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { deleteProduct, getMyProducts } from '@/services/seller';

export default function SellerProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

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

  const handleDelete = (item: any) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${item.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(item.id);
            try {
              await deleteProduct(item.id);
              setProducts((prev) => prev.filter((p) => p.id !== item.id));
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || 'Failed to delete product');
            } finally {
              setDeleting(null);
            }
          },
        },
      ],
    );
  };

  const handleToggleActive = (item: any) => {
    // Quick toggle via update endpoint
    Alert.alert(
      item.is_active ? 'Deactivate Product' : 'Activate Product',
      item.is_active
        ? 'This product will no longer be visible to buyers.'
        : 'This product will be visible to buyers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const formData = new FormData();
              formData.append('is_active', item.is_active ? 'false' : 'true');
              const { updateProduct } = await import('@/services/seller');
              await updateProduct(item.id, formData);
              setProducts((prev) =>
                prev.map((p) => (p.id === item.id ? { ...p, is_active: !p.is_active } : p))
              );
            } catch (e: any) {
              Alert.alert('Error', 'Failed to update product');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Pressable
        style={styles.cardBody}
        onPress={() => router.push(`/seller/products/edit?id=${item.id}` as any)}
      >
        {item.primary_image_url ? (
          <Image source={{ uri: item.primary_image_url }} style={styles.productImage} contentFit="cover" />
        ) : (
          <View style={styles.productImageFallback}>
            <MaterialCommunityIcons name="package-variant" size={28} color={Brand.textTertiary} />
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productPrice}>UGX {Number(item.final_price || item.price).toLocaleString()}</Text>
          <View style={styles.productMeta}>
            <View style={[styles.statusDot, { backgroundColor: item.is_active ? '#16A34A' : Brand.textTertiary }]} />
            <Text style={styles.productStatus}>{item.is_active ? 'Active' : 'Inactive'}</Text>
            <Text style={styles.stockText}> · {item.stock_quantity} in stock</Text>
          </View>
        </View>
      </Pressable>
      <View style={styles.cardActions}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => handleToggleActive(item)}
        >
          <MaterialCommunityIcons
            name={item.is_active ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={Brand.textSecondary}
          />
          <Text style={styles.actionBtnText}>{item.is_active ? 'Hide' : 'Show'}</Text>
        </Pressable>
        <Pressable
          style={styles.actionBtn}
          onPress={() => router.push(`/seller/products/edit?id=${item.id}` as any)}
        >
          <MaterialCommunityIcons name="pencil-outline" size={18} color={Brand.primary} />
          <Text style={[styles.actionBtnText, { color: Brand.primary }]}>Edit</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.deleteBtn]}
          onPress={() => handleDelete(item)}
          disabled={deleting === item.id}
        >
          {deleting === item.id ? (
            <ActivityIndicator size="small" color={Brand.danger} />
          ) : (
            <>
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={Brand.danger} />
              <Text style={[styles.actionBtnText, { color: Brand.danger }]}>Delete</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.primary, Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>My Products</Text>
          <Pressable
            hitSlop={12}
            onPress={() => router.push('/seller/products/add' as any)}
          >
            <MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>

        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        ) : products.length === 0 ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="package-variant" size={56} color={Brand.textTertiary} />
            <Text style={styles.emptyText}>No products yet</Text>
            <Text style={styles.emptySub}>Add your first product to start selling</Text>
            <Pressable
              style={styles.addBtn}
              onPress={() => router.push('/seller/products/add' as any)}
            >
              <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add Product</Text>
            </Pressable>
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
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { marginTop: 12, fontSize: 16, fontWeight: '700', color: Brand.text },
  emptySub: { marginTop: 4, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 12, marginTop: 20, elevation: 3,
    shadowColor: Brand.primary, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  list: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  cardBody: { flexDirection: 'row', gap: 12, padding: 12 },
  productImage: { width: 70, height: 70, borderRadius: 10 },
  productImageFallback: { width: 70, height: 70, borderRadius: 10, backgroundColor: Brand.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  productInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  productName: { fontSize: 15, fontWeight: '600', color: Brand.text },
  productPrice: { fontSize: 14, fontWeight: '700', color: Brand.primary },
  productMeta: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  productStatus: { fontSize: 12, color: Brand.textSecondary, fontWeight: '600' },
  stockText: { fontSize: 12, color: Brand.textTertiary },
  cardActions: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: Brand.border,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  deleteBtn: { borderLeftWidth: 1, borderLeftColor: Brand.border },
});
