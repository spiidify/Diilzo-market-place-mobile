import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GradientHeader } from '@/components/GradientHeader';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { clearCart, getCart, removeCartItem, updateCartItem } from '@/services/cart';
import { playSound, Sounds } from '@/services/sound';
import type { CartItem, Cart as CartType } from '@/types';

export default function CartScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { setCartCount: setGlobalCartCount, refreshCartCount } = useCart();
  const [cart, setCart] = useState<CartType | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [connectionError, setConnectionError] = useState(false);

  const loadCart = useCallback(async () => {
    try {
      setConnectionError(false);
      const data = await getCart();
      setCart(data);
      setGlobalCartCount(data.total_items);
    } catch (e: any) {
      console.error('Cart load error:', e?.message);
      setConnectionError(true);
    } finally {
      setLoading(false);
    }
  }, [setGlobalCartCount]);

  // Reload cart every time the screen gains focus (real-time sync)
  useFocusEffect(
    useCallback(() => {
      loadCart();
    }, [loadCart])
  );

  // Optimistic helpers - update local cart state instantly, sync with API in background
  const updateLocalCart = (updater: (prev: CartType) => CartType) => {
    setCart((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
  };

  const recalcTotals = (items: CartItem[]): { total_items: number; total_price: string } => {
    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
    const totalPrice = items.reduce((sum, i) => sum + Number(i.total_price), 0);
    return { total_items: totalItems, total_price: String(totalPrice) };
  };

  const handleQtyChange = async (item: CartItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty < 1) return;

    playSound(Sounds.TAP);
    const oldItem = { ...item };
    const oldTotalItems = cart?.total_items || 0;
    updateLocalCart((prev) => {
      const items = prev.items.map((i) =>
        i.id === item.id
          ? { ...i, quantity: newQty, total_price: String(Number(i.total_price) / i.quantity * newQty) }
          : i
      );
      const totals = recalcTotals(items);
      return { ...prev, items, total_items: totals.total_items, total_price: totals.total_price };
    });
    setGlobalCartCount(Math.max(0, oldTotalItems + delta));

    setUpdating(item.id);
    try {
      await updateCartItem(item.id, newQty);
    } catch {
      updateLocalCart((prev) => {
        const items = prev.items.map((i) => (i.id === item.id ? oldItem : i));
        const totals = recalcTotals(items);
        return { ...prev, items, total_items: totals.total_items, total_price: totals.total_price };
      });
      setGlobalCartCount(oldTotalItems);
      Alert.alert('Error', 'Failed to update quantity');
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (item: CartItem) => {
    // Save deep copies for rollback
    const oldItems = cart?.items.map((i) => ({ ...i })) || [];
    const oldTotalItems = cart?.total_items || 0;

    // Optimistic: remove from local state immediately
    updateLocalCart((prev) => {
      const items = prev.items.filter((i) => i.id !== item.id);
      const totals = recalcTotals(items);
      return { ...prev, items, total_items: totals.total_items, total_price: totals.total_price };
    });
    setGlobalCartCount(Math.max(0, oldTotalItems - item.quantity));

    try {
      await removeCartItem(item.id);
      // Sync count from server after success
      refreshCartCount();
    } catch (e: any) {
      // Restore old items on failure
      setCart((prev) => {
        if (!prev) return prev;
        const totals = recalcTotals(oldItems);
        return { ...prev, items: oldItems, total_items: totals.total_items, total_price: totals.total_price };
      });
      setGlobalCartCount(oldTotalItems);
      Alert.alert('Error', 'Failed to remove item. Please try again.');
    }
  };

  const handleClear = () => {
    Alert.alert('Clear cart', 'Remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          const oldItems = cart?.items.map((i) => ({ ...i })) || [];
          const oldTotalItems = cart?.total_items || 0;
          updateLocalCart((prev) => ({
            ...prev,
            items: [],
            total_items: 0,
            total_price: '0',
          }));
          setGlobalCartCount(0);

          try {
            await clearCart();
          } catch {
            setCart((prev) => {
              if (!prev) return prev;
              const totals = recalcTotals(oldItems);
              return { ...prev, items: oldItems, total_items: totals.total_items, total_price: totals.total_price };
            });
            setGlobalCartCount(oldTotalItems);
            Alert.alert('Error', 'Failed to clear cart');
          }
        },
      },
    ]);
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to proceed to checkout.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
        ],
      );
      return;
    }
    router.push('/checkout');
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.screen}>
        <GradientHeader title="Shopping Cart" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
          <Text style={styles.loadingText}>Loading your cart...</Text>
        </View>
      </View>
    );
  }

  // Connection error state
  if (connectionError && (!cart || cart.items.length === 0)) {
    return (
      <View style={styles.screen}>
        <GradientHeader title="Shopping Cart" />
        <View style={styles.centerBody}>
          <View style={styles.errorIconCircle}>
            <MaterialCommunityIcons name="wifi-off" size={48} color="#FFFFFF" />
          </View>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.emptySub}>
            We couldn't load your cart. Check your internet connection and try again.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.shopBtn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              setLoading(true);
              loadCart();
            }}
          >
            <MaterialCommunityIcons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.shopBtnText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Empty cart state
  if (!cart || cart.items.length === 0) {
    return (
      <View style={styles.screen}>
        <GradientHeader title="Shopping Cart" />
        <View style={styles.centerBody}>
          <View style={styles.emptyIconWrap}>
            <LinearGradient
              colors={[Brand.primaryDark, Brand.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyIconCircle}
            >
              <MaterialCommunityIcons name="cart-outline" size={56} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySub}>
            Discover great deals and products from top sellers on Diilzo.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.shopBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/')}
          >
            <MaterialCommunityIcons name="store" size={20} color="#FFFFFF" />
            <Text style={styles.shopBtnText}>Start Shopping</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const currency = cart.items[0]?.product.currency || 'UGX';

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Pressable onPress={() => router.push(`/product/${item.product.slug}`)}>
          {item.product.primary_image_url ? (
            <Image
              source={{ uri: item.product.primary_image_url }}
              style={styles.itemImage}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.itemImage, styles.noImage]}>
              <MaterialCommunityIcons name="package-variant-closed" size={28} color="#ccc" />
            </View>
          )}
        </Pressable>

        <View style={styles.itemInfo}>
          <Pressable onPress={() => router.push(`/product/${item.product.slug}`)}>
            <Text style={styles.itemName} numberOfLines={2}>{item.product.name}</Text>
          </Pressable>
          {item.product.store && (
            <View style={styles.storeRow}>
              <MaterialCommunityIcons name="store-outline" size={13} color={Brand.textTertiary} />
              <Text style={styles.itemStore} numberOfLines={1}>{item.product.store.name}</Text>
            </View>
          )}

          <View style={styles.itemBottom}>
            <View style={styles.priceCol}>
              <Text style={styles.currencyText}>{currency}</Text>
              <Text style={styles.itemPrice}>{Number(item.total_price).toLocaleString()}</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.6 }]}
                onPress={() => handleQtyChange(item, -1)}
                disabled={updating === item.id}
              >
                <MaterialCommunityIcons name="minus" size={18} color={Brand.primary} />
              </Pressable>
              <Text style={styles.stepperValue}>
                {updating === item.id ? '...' : item.quantity}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.6 }]}
                onPress={() => handleQtyChange(item, 1)}
                disabled={updating === item.id}
              >
                <MaterialCommunityIcons name="plus" size={18} color={Brand.primary} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.removeRow, pressed && { opacity: 0.6 }]}
        onPress={() => handleRemove(item)}
      >
        <MaterialCommunityIcons name="trash-can-outline" size={16} color={Brand.danger} />
        <Text style={styles.removeText}>Remove</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Shopping Cart"
        subtitle={`${cart.total_items} ${cart.total_items === 1 ? 'item' : 'items'}`}
        rightIcon="delete-sweep-outline"
        onRightPress={handleClear}
      />

      <FlatList
        data={cart.items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onRefresh={loadCart}
        refreshing={false}
      />

      <View style={styles.bottomBar}>
        <View style={styles.bottomBarTop}>
          <View style={styles.subtotalCol}>
            <Text style={styles.subtotalLabel}>Subtotal</Text>
            <View style={styles.totalRow}>
              <Text style={styles.totalCurrency}>{currency}</Text>
              <Text style={styles.totalAmount}>{Number(cart.total_price).toLocaleString()}</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.checkoutBtn, pressed && { opacity: 0.85 }]}
            onPress={handleCheckout}
          >
            <MaterialCommunityIcons name="cart-arrow-right" size={22} color="#FFFFFF" />
            <Text style={styles.checkoutBtnText}>Checkout</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F2F4F6' },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.four },
  loadingText: { marginTop: Spacing.two, fontSize: 14, color: Brand.textSecondary },
  emptyIconWrap: { marginBottom: Spacing.four },
  emptyIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: Brand.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  errorIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Brand.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.three,
    elevation: 6,
    shadowColor: Brand.danger,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  errorTitle: { fontSize: 20, fontWeight: '800', color: Brand.text, textAlign: 'center' },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: Brand.text, textAlign: 'center' },
  emptySub: {
    fontSize: 14,
    color: Brand.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.one + 2,
    marginBottom: Spacing.four,
    paddingHorizontal: Spacing.four,
    lineHeight: 20,
  },
  shopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Brand.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    elevation: 4,
    shadowColor: Brand.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  shopBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },

  list: {
    paddingHorizontal: Spacing.two + 2,
    paddingTop: Spacing.two,
    paddingBottom: 140,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: Spacing.two + 2,
    padding: Spacing.two + 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardBody: { flexDirection: 'row', gap: Spacing.two + 2 },
  itemImage: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  noImage: { justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1, gap: 4 },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.text,
    lineHeight: 19,
  },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemStore: { fontSize: 12, color: Brand.textTertiary, flex: 1 },
  itemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  priceCol: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  currencyText: { fontSize: 12, fontWeight: '700', color: Brand.textSecondary },
  itemPrice: { fontSize: 17, fontWeight: '800', color: Brand.text },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.surfaceAlt,
    borderRadius: 10,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    minWidth: 32,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: Brand.text,
  },

  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: Spacing.one + 2,
    paddingTop: Spacing.one + 2,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  removeText: { color: Brand.danger, fontSize: 13, fontWeight: '600' },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    paddingBottom: Platform.select({ ios: Spacing.two + 6, android: Spacing.two + 2 }),
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },
  bottomBarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtotalCol: { gap: 2 },
  subtotalLabel: { fontSize: 12, color: Brand.textTertiary, fontWeight: '600' },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  totalCurrency: { fontSize: 13, fontWeight: '700', color: Brand.text },
  totalAmount: { fontSize: 22, fontWeight: '900', color: Brand.text },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    backgroundColor: Brand.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    elevation: 4,
    shadowColor: Brand.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  checkoutBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
