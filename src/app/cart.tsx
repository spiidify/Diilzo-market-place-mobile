import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, FlatList, Pressable, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { getCart, updateCartItem, removeCartItem, clearCart } from '@/services/cart';
import type { Cart as CartType, CartItem } from '@/types';

const ORANGE = '#ff6a00';

export default function CartScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState<CartType | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const loadCart = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      const data = await getCart();
      setCart(data);
    } catch (e: any) {
      console.error('Cart load error:', e?.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { loadCart(); }, [loadCart]);

  const handleQtyChange = async (item: CartItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    setUpdating(item.id);
    try {
      await updateCartItem(item.id, newQty);
      await loadCart();
    } catch (e: any) {
      Alert.alert('Error', 'Failed to update quantity');
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (item: CartItem) => {
    Alert.alert('Remove item', `Remove ${item.product.name} from cart?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await removeCartItem(item.id);
            await loadCart();
          } catch {
            Alert.alert('Error', 'Failed to remove item');
          }
        },
      },
    ]);
  };

  const handleClear = () => {
    Alert.alert('Clear cart', 'Remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          try { await clearCart(); await loadCart(); } catch { Alert.alert('Error', 'Failed to clear cart'); }
        },
      },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <ThemedView style={styles.center}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title" style={styles.emptyTitle}>Sign in to view your cart</ThemedText>
          <Pressable style={styles.btn} onPress={() => router.push('/(auth)/login')}>
            <ThemedText style={styles.btnText}>Sign In</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <SafeAreaView style={styles.safeArea}>
          <ActivityIndicator size="large" color={ORANGE} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <ThemedView style={styles.center}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title" style={styles.emptyTitle}>Your cart is empty</ThemedText>
          <ThemedText type="small" style={styles.emptySub}>Browse products and add items to your cart.</ThemedText>
          <Pressable style={styles.btn} onPress={() => router.push('/')}>
            <ThemedText style={styles.btnText}>Browse Products</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const renderItem = ({ item }: { item: CartItem }) => (
    <ThemedView style={styles.cartItem}>
      <Pressable onPress={() => router.push(`/product/${item.product.slug}`)}>
        {item.product.primary_image_url ? (
          <Image source={{ uri: item.product.primary_image_url }} style={styles.itemImage} contentFit="cover" />
        ) : (
          <ThemedView type="backgroundElement" style={[styles.itemImage, styles.noImage]}>
            <ThemedText type="small">No img</ThemedText>
          </ThemedView>
        )}
      </Pressable>
      <ThemedView style={styles.itemInfo}>
        <ThemedText type="default" style={styles.itemName} numberOfLines={2}>{item.product.name}</ThemedText>
        {item.product.store && <ThemedText type="small" style={styles.itemStore}>{item.product.store.name}</ThemedText>}
        <ThemedView style={styles.priceRow}>
          <ThemedText type="small" style={styles.currency}>{item.product.currency}</ThemedText>
          <ThemedText type="title" style={styles.itemPrice}>{Number(item.total_price).toLocaleString()}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.qtyRow}>
          <Pressable style={styles.qtyBtn} onPress={() => handleQtyChange(item, -1)} disabled={updating === item.id}>
            <ThemedText style={styles.qtyBtnText}>−</ThemedText>
          </Pressable>
          <ThemedText type="default" style={styles.qtyValue}>{item.quantity}</ThemedText>
          <Pressable style={styles.qtyBtn} onPress={() => handleQtyChange(item, 1)} disabled={updating === item.id}>
            <ThemedText style={styles.qtyBtnText}>+</ThemedText>
          </Pressable>
          <Pressable style={styles.removeBtn} onPress={() => handleRemove(item)}>
            <ThemedText type="small" style={styles.removeText}>Remove</ThemedText>
          </Pressable>
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">My Cart</ThemedText>
          <Pressable onPress={handleClear}><ThemedText type="small" style={styles.clearText}>Clear all</ThemedText></Pressable>
        </ThemedView>
        <FlatList
          data={cart.items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onRefresh={loadCart}
          refreshing={false}
        />
        <ThemedView style={styles.summary}>
          <ThemedView style={styles.summaryRow}>
            <ThemedText type="default" style={styles.summaryLabel}>Total items</ThemedText>
            <ThemedText type="default">{cart.total_items}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.summaryRow}>
            <ThemedText type="title" style={styles.summaryLabel}>Total</ThemedText>
            <ThemedView style={styles.totalRow}>
              <ThemedText type="small" style={styles.currency}>UGX</ThemedText>
              <ThemedText type="title" style={styles.totalAmount}>{Number(cart.total_price).toLocaleString()}</ThemedText>
            </ThemedView>
          </ThemedView>
          <Pressable style={styles.checkoutBtn}>
            <ThemedText style={styles.checkoutText}>Proceed to Checkout</ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  clearText: { color: '#e2231a' },
  list: { paddingHorizontal: Spacing.three, paddingBottom: 200 },
  cartItem: { flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.two, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  itemImage: { width: 80, height: 80, borderRadius: 8 },
  noImage: { justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontWeight: '600' },
  itemStore: { opacity: 0.5, fontSize: 11 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  currency: { fontSize: 11, color: ORANGE, opacity: 0.8 },
  itemPrice: { fontSize: 16, fontWeight: '700', color: ORANGE },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 18, fontWeight: '600' },
  qtyValue: { fontSize: 15, fontWeight: '600', minWidth: 24, textAlign: 'center' },
  removeBtn: { marginLeft: 'auto' },
  removeText: { color: '#e2231a', fontSize: 12 },
  summary: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', padding: Spacing.three, gap: Spacing.two },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontWeight: '600' },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  totalAmount: { fontSize: 22, fontWeight: '800', color: ORANGE },
  checkoutBtn: { backgroundColor: ORANGE, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  checkoutText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  emptyTitle: { marginBottom: Spacing.two, textAlign: 'center' },
  emptySub: { opacity: 0.5, textAlign: 'center', marginBottom: Spacing.three },
  btn: { backgroundColor: ORANGE, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  btnText: { color: '#fff', fontWeight: '700' },
});
