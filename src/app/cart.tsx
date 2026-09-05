import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert,
  FlatList, Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { clearCart, getCart, removeCartItem, updateCartItem } from '@/services/cart';
import type { CartItem, Cart as CartType } from '@/types';

const ORANGE = Brand.primary; // Vibrant Green primary
const LINK = Brand.primary;
const DANGER = Brand.danger;
const PRICE_BLACK = Brand.text;
const HEADER_DARK = '#131921';
const DIVIDER = '#E7E7E7';

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

  const handleCheckout = () => {
    router.push('/checkout');
  };

  // Not signed in state
  if (!isAuthenticated) {
    return (
      <ThemedView style={styles.center}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.darkHeader}>
            <ThemedText style={styles.headerTitle}>Your Cart</ThemedText>
          </View>
          <View style={styles.centerContent}>
            <MaterialCommunityIcons name="cart-outline" size={72} color="#999" />
            <ThemedText style={styles.emptyTitle}>Sign in to view your cart</ThemedText>
            <ThemedText style={styles.emptySub}>Your saved items will appear here once you sign in.</ThemedText>
            <Pressable style={styles.orangeBtn} onPress={() => router.push('/(auth)/login')}>
              <ThemedText style={styles.orangeBtnText}>Sign In</ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Loading state
  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.darkHeader}>
            <ThemedText style={styles.headerTitle}>Your Cart</ThemedText>
          </View>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={ORANGE} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Empty cart state
  if (!cart || cart.items.length === 0) {
    return (
      <ThemedView style={styles.center}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.darkHeader}>
            <ThemedText style={styles.headerTitle}>Your Cart</ThemedText>
          </View>
          <View style={styles.centerContent}>
            <MaterialCommunityIcons name="cart-off" size={72} color="#999" />
            <ThemedText style={styles.emptyTitle}>Your cart is empty</ThemedText>
            <ThemedText style={styles.emptySub}>Browse products and add items to your cart.</ThemedText>
            <Pressable style={styles.orangeBtn} onPress={() => router.push('/')}>
              <ThemedText style={styles.orangeBtnText}>Browse Products</ThemedText>
            </Pressable>
          </View>
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
          <View style={[styles.itemImage, styles.noImage]}>
            <MaterialCommunityIcons name="package-variant-closed" size={36} color="#bbb" />
          </View>
        )}
      </Pressable>
      <ThemedView style={styles.itemInfo}>
        <Pressable onPress={() => router.push(`/product/${item.product.slug}`)}>
          <ThemedText style={styles.itemName} numberOfLines={2}>{item.product.name}</ThemedText>
        </Pressable>
        {item.product.store && (
          <Pressable onPress={() => { }}>
            <ThemedText style={styles.itemStore}>{item.product.store.name}</ThemedText>
          </Pressable>
        )}
        <ThemedView style={styles.priceRow}>
          <ThemedText style={styles.currency}>{item.product.currency}</ThemedText>
          <ThemedText style={styles.itemPrice}>{Number(item.total_price).toLocaleString()}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.qtyRow}>
          <Pressable
            style={styles.qtyBtn}
            onPress={() => handleQtyChange(item, -1)}
            disabled={updating === item.id}
          >
            <MaterialCommunityIcons name="minus" size={20} color={PRICE_BLACK} />
          </Pressable>
          <ThemedText style={styles.qtyValue}>{item.quantity}</ThemedText>
          <Pressable
            style={styles.qtyBtn}
            onPress={() => handleQtyChange(item, 1)}
            disabled={updating === item.id}
          >
            <MaterialCommunityIcons name="plus" size={20} color={PRICE_BLACK} />
          </Pressable>
          <Pressable style={styles.removeBtn} onPress={() => handleRemove(item)}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={DANGER} />
            <ThemedText style={styles.removeText}>Remove</ThemedText>
          </Pressable>
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Dark Header */}
        <View style={styles.darkHeader}>
          <ThemedText style={styles.headerTitle}>Your Cart</ThemedText>
        </View>

        {/* Cart List */}
        <FlatList
          data={cart.items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onRefresh={loadCart}
          refreshing={false}
        />

        {/* Bottom Summary Bar */}
        <View style={styles.summaryWrap}>
          <Pressable style={styles.clearLink} onPress={handleClear}>
            <MaterialCommunityIcons name="delete-outline" size={18} color={DANGER} />
            <ThemedText style={styles.clearLinkText}>Clear cart</ThemedText>
          </Pressable>
          <View style={styles.summary}>
            <View style={styles.summaryTop}>
              <ThemedText style={styles.subtotalLabel}>
                Subtotal ({cart.total_items} {cart.total_items === 1 ? 'item' : 'items'})
              </ThemedText>
              <View style={styles.totalRow}>
                <ThemedText style={styles.totalCurrency}>{cart.items[0]?.product.currency || 'UGX'}</ThemedText>
                <ThemedText style={styles.totalAmount}>{Number(cart.total_price).toLocaleString()}</ThemedText>
              </View>
            </View>
            <Pressable style={styles.checkoutBtn} onPress={handleCheckout}>
              <ThemedText style={styles.checkoutText}>Proceed to Checkout</ThemedText>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.four },
  darkHeader: {
    backgroundColor: HEADER_DARK,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: Spacing.three,
    textAlign: 'center',
    color: PRICE_BLACK,
  },
  emptySub: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: Spacing.one,
    marginBottom: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  orangeBtn: {
    backgroundColor: ORANGE,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  orangeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 220,
  },
  cartItem: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  noImage: {
    backgroundColor: '#f3f3f3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: PRICE_BLACK,
  },
  itemStore: {
    color: LINK,
    fontSize: 12,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    marginTop: 6,
  },
  currency: {
    fontSize: 12,
    fontWeight: '600',
    color: PRICE_BLACK,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: PRICE_BLACK,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyValue: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
    color: PRICE_BLACK,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  removeText: {
    color: DANGER,
    fontSize: 13,
    fontWeight: '500',
  },
  summaryWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  clearLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    paddingVertical: Spacing.one,
    marginBottom: 2,
  },
  clearLinkText: {
    color: DANGER,
    fontSize: 13,
    fontWeight: '500',
  },
  summary: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  totalCurrency: {
    fontSize: 13,
    fontWeight: '600',
    color: PRICE_BLACK,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: PRICE_BLACK,
  },
  checkoutBtn: {
    backgroundColor: ORANGE,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  checkoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
