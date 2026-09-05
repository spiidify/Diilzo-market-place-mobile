import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/services/api';
import { clearCart, getCart } from '@/services/cart';
import { validateCoupon } from '@/services/catalog';
import {
  checkPaymentStatus,
  fetchPaymentMethods,
  initiatePayment,
  type PaymentMethod,
} from '@/services/payments';
import type { Address, Cart as CartType } from '@/types';

// ── Payment method definitions ────────────────────────────────────
const PAYMENT_OPTIONS: {
  method: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  requiresPhone: boolean;
}[] = [
    { method: 'mtn_momo', label: 'MTN MoMo', icon: 'cellphone', requiresPhone: true },
    { method: 'airtel_money', label: 'Airtel Money', icon: 'cellphone-link', requiresPhone: true },
    { method: 'paypal', label: 'PayPal', icon: 'credit-card-outline', requiresPhone: false },
    { method: 'cod', label: 'Cash on Delivery', icon: 'cash', requiresPhone: false },
  ];

const SHIPPING_FEE = 5000;
const TAX_RATE = 0.0; // tax included in product prices

export default function CheckoutScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [cart, setCart] = useState<CartType | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('mtn_momo');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [couponCode, setCouponCode] = useState<string>('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCheckout = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [cartData, addrData] = await Promise.all([
        getCart(),
        apiRequest<{ results: Address[] } | Address[]>({ method: 'GET', url: '/addresses/' }).then(
          (d) => (Array.isArray(d) ? d : d.results || [])
        ),
      ]);
      setCart(cartData);
      setAddresses(addrData);
      const defaultAddr = addrData.find((a) => a.is_default) || addrData[0];
      if (defaultAddr) setSelectedAddressId(defaultAddr.id);
      if (user?.phone) setPhoneNumber(user.phone);

      // Fetch available payment methods (fallback to hardcoded options)
      try {
        const methods = await fetchPaymentMethods();
        setPaymentMethods(methods);
        if (methods.length > 0 && !methods.find((m) => m.method === selectedMethod)) {
          setSelectedMethod(methods[0].method);
        }
      } catch {
        // Use default PAYMENT_OPTIONS
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load checkout');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, selectedMethod, user?.phone]);

  useEffect(() => {
    loadCheckout();
  }, [loadCheckout]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const subtotal = cart ? Number(cart.total_price) : 0;
  const shipping = subtotal > 0 ? SHIPPING_FEE : 0;
  const tax = Math.round(subtotal * TAX_RATE);
  const total = Math.max(0, subtotal + shipping + tax - discount);

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponMsg({ type: 'error', text: 'Enter a coupon code' });
      return;
    }
    setCouponLoading(true);
    setCouponMsg(null);
    try {
      const result = await validateCoupon(couponCode.trim());
      let calcDiscount = 0;
      if (result.discount_type === 'percentage') {
        calcDiscount = Math.round((subtotal * result.discount_value) / 100);
      } else {
        calcDiscount = result.discount_value;
      }
      if (result.min_order_amount && subtotal < result.min_order_amount) {
        setCouponMsg({
          type: 'error',
          text: `Minimum order UGX ${result.min_order_amount.toLocaleString()} required`,
        });
        setDiscount(0);
      } else {
        setDiscount(calcDiscount);
        setCouponMsg({
          type: 'success',
          text: `Coupon applied — UGX ${calcDiscount.toLocaleString()} off`,
        });
      }
    } catch (e: any) {
      setDiscount(0);
      setCouponMsg({ type: 'error', text: e?.message || 'Invalid coupon code' });
    } finally {
      setCouponLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!cart || cart.items.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty.');
      return;
    }
    if (!selectedAddressId) {
      Alert.alert('Select Address', 'Please choose a shipping address.');
      return;
    }
    const opt = PAYMENT_OPTIONS.find((o) => o.method === selectedMethod);
    if (opt?.requiresPhone && !phoneNumber.trim()) {
      Alert.alert('Phone Required', 'Enter your mobile money phone number.');
      return;
    }

    setPlacing(true);
    setError(null);
    try {
      // 1. Create the order
      const order = await apiRequest<{ id: number; order_number: string }>({
        method: 'POST',
        url: '/orders/',
        data: {
          address_id: selectedAddressId,
          coupon_code: discount > 0 ? couponCode.trim() : undefined,
          payment_method: selectedMethod,
        },
      });

      // 2. Initiate payment
      const initResult = await initiatePayment({
        order_id: order.id,
        method: selectedMethod,
        phone: opt?.requiresPhone ? phoneNumber.trim() : undefined,
        return_url: Linking.createURL('/checkout'),
      });

      // 3. Handle by method
      if (selectedMethod === 'paypal' && initResult.redirect_url) {
        Linking.openURL(initResult.redirect_url);
        Alert.alert(
          'PayPal',
          'Complete your PayPal payment in the browser. We will verify your payment status.',
          [{ text: 'OK', onPress: () => pollPaymentStatus(order.id, initResult.payment_id) }]
        );
      } else if (opt?.requiresPhone) {
        // Mobile money — poll for status
        Alert.alert(
          'Payment Sent',
          `A payment request was sent to ${phoneNumber}. Approve it on your phone to complete the order.`,
          [{ text: 'OK', onPress: () => pollPaymentStatus(order.id, initResult.payment_id) }]
        );
      } else {
        // Cash on delivery — success immediately
        await clearCart();
        Alert.alert('Order Placed', `Order #${order.order_number} placed successfully.`, [
          { text: 'View Order', onPress: () => router.replace(`/buyer/orders/${order.id}` as any) },
        ]);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to place order');
      Alert.alert('Checkout Error', e?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  const pollPaymentStatus = (orderId: number, paymentId: number) => {
    setPlacing(true);
    let attempts = 0;
    const maxAttempts = 30; // ~2.5 minutes at 5s intervals
    pollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const status = await checkPaymentStatus(paymentId);
        if (status.status === 'completed' || status.status === 'success') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          await clearCart();
          setPlacing(false);
          Alert.alert('Payment Successful', 'Your order has been placed!', [
            {
              text: 'View Order',
              onPress: () => router.replace(`/buyer/orders/${orderId}` as any),
            },
          ]);
        } else if (status.status === 'failed' || status.status === 'cancelled') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setPlacing(false);
          Alert.alert('Payment Failed', 'Your payment was not completed. Please try again.');
        } else if (attempts >= maxAttempts) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setPlacing(false);
          Alert.alert(
            'Payment Pending',
            'We are still confirming your payment. You can check your order status later.',
            [{ text: 'View Order', onPress: () => router.replace(`/buyer/orders/${orderId}` as any) }]
          );
        }
      } catch {
        // ignore transient errors during polling
      }
    }, 5000);
  };

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const selectedOpt = PAYMENT_OPTIONS.find((o) => o.method === selectedMethod);

  if (loading) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <LinearGradient
            colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Checkout</Text>
            <View style={{ width: 24 }} />
          </LinearGradient>
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading checkout…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error && !cart) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <LinearGradient
            colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Checkout</Text>
            <View style={{ width: 24 }} />
          </LinearGradient>
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={loadCheckout}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient
          colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={80}
        >
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {/* Shipping Address */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="map-marker-check-outline" size={20} color={Brand.primary} />
                <Text style={styles.sectionTitle}>Shipping Address</Text>
              </View>
              {addresses.length === 0 ? (
                <Pressable
                  style={styles.addAddressBtn}
                  onPress={() => router.push('/buyer/addresses' as any)}
                >
                  <MaterialCommunityIcons name="plus" size={20} color={Brand.primary} />
                  <Text style={styles.addAddressText}>Add a delivery address</Text>
                </Pressable>
              ) : (
                addresses.map((addr) => {
                  const selected = addr.id === selectedAddressId;
                  return (
                    <Pressable
                      key={`addr-${addr.id}`}
                      style={({ pressed }) => [
                        styles.addressCard,
                        selected && styles.addressCardSelected,
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={() => setSelectedAddressId(addr.id)}
                    >
                      <View style={styles.addressRadio}>
                        {selected && <View style={styles.addressRadioDot} />}
                      </View>
                      <View style={styles.addressInfo}>
                        <Text style={styles.addressLabel}>{addr.label}</Text>
                        <Text style={styles.addressText}>{addr.street}, {addr.city}</Text>
                        <Text style={styles.addressText}>{addr.state} {addr.postal_code}, {addr.country}</Text>
                        <Text style={styles.addressPhone}>{addr.phone}</Text>
                      </View>
                      {addr.is_default && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })
              )}
            </View>

            {/* Order Summary */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="clipboard-list-outline" size={20} color={Brand.primary} />
                <Text style={styles.sectionTitle}>Order Summary</Text>
              </View>
              <View style={styles.summaryCard}>
                {cart?.items.map((item) => (
                  <View key={`ci-${item.id}`} style={styles.summaryItem}>
                    <Text style={styles.summaryItemName} numberOfLines={1}>
                      {item.product.name}
                    </Text>
                    <Text style={styles.summaryItemQty}>×{item.quantity}</Text>
                    <Text style={styles.summaryItemPrice}>
                      UGX {Number(item.total_price).toLocaleString()}
                    </Text>
                  </View>
                ))}
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryRowLabel}>Subtotal</Text>
                  <Text style={styles.summaryRowValue}>UGX {subtotal.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryRowLabel}>Shipping</Text>
                  <Text style={styles.summaryRowValue}>UGX {shipping.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryRowLabel}>Tax</Text>
                  <Text style={styles.summaryRowValue}>UGX {tax.toLocaleString()}</Text>
                </View>
                {discount > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryRowLabel, { color: Brand.primary }]}>Discount</Text>
                    <Text style={[styles.summaryRowValue, { color: Brand.primary }]}>
                      −UGX {discount.toLocaleString()}
                    </Text>
                  </View>
                )}
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>UGX {total.toLocaleString()}</Text>
                </View>
              </View>
            </View>

            {/* Coupon */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="ticket-percent-outline" size={20} color={Brand.primary} />
                <Text style={styles.sectionTitle}>Coupon Code</Text>
              </View>
              <View style={styles.couponRow}>
                <TextInput
                  style={styles.couponInput}
                  placeholder="Enter coupon code"
                  placeholderTextColor={Brand.textTertiary}
                  value={couponCode}
                  onChangeText={setCouponCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <Pressable
                  style={({ pressed }) => [styles.couponBtn, pressed && { opacity: 0.8 }]}
                  onPress={handleValidateCoupon}
                  disabled={couponLoading}
                >
                  {couponLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.couponBtnText}>Apply</Text>
                  )}
                </Pressable>
              </View>
              {couponMsg && (
                <Text style={[styles.couponMsg, couponMsg.type === 'error' && { color: Brand.danger }]}>
                  {couponMsg.text}
                </Text>
              )}
            </View>

            {/* Payment Method */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="credit-card-check-outline" size={20} color={Brand.primary} />
                <Text style={styles.sectionTitle}>Payment Method</Text>
              </View>
              {PAYMENT_OPTIONS.map((opt) => {
                const selected = opt.method === selectedMethod;
                const isAvailable =
                  paymentMethods.length === 0 || paymentMethods.some((m) => m.method === opt.method);
                if (!isAvailable) return null;
                return (
                  <Pressable
                    key={`pm-${opt.method}`}
                    style={({ pressed }) => [
                      styles.paymentCard,
                      selected && styles.paymentCardSelected,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => setSelectedMethod(opt.method)}
                  >
                    <View style={[styles.paymentIcon, { backgroundColor: Brand.surfaceAlt }]}>
                      <MaterialCommunityIcons name={opt.icon} size={22} color={Brand.primary} />
                    </View>
                    <Text style={styles.paymentLabel}>{opt.label}</Text>
                    <View style={styles.paymentRadio}>
                      {selected && <View style={styles.paymentRadioDot} />}
                    </View>
                  </Pressable>
                );
              })}

              {/* Phone number for mobile money */}
              {selectedOpt?.requiresPhone && (
                <View style={styles.phoneWrap}>
                  <Text style={styles.phoneLabel}>Mobile Money Phone Number</Text>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="e.g. 07XXXXXXXX"
                    placeholderTextColor={Brand.textTertiary}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    autoCorrect={false}
                  />
                </View>
              )}
            </View>
          </ScrollView>

          {/* Place Order Button */}
          <View style={styles.footer}>
            <View style={styles.footerTotal}>
              <Text style={styles.footerTotalLabel}>Total</Text>
              <Text style={styles.footerTotalValue}>UGX {total.toLocaleString()}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.placeOrderBtn, pressed && { opacity: 0.85 }]}
              onPress={handlePlaceOrder}
              disabled={placing || !cart || cart.items.length === 0 || !selectedAddressId}
            >
              {placing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check-circle-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.placeOrderBtnText}>Place Order</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.four },
  loadingText: { marginTop: Spacing.two, fontSize: 14, color: Brand.textSecondary },
  errorText: { marginTop: Spacing.two, fontSize: 15, color: Brand.danger, textAlign: 'center' },
  retryBtn: {
    marginTop: Spacing.three,
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: 10,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.three, paddingBottom: Spacing.six },

  // Sections
  section: { marginBottom: Spacing.three },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.text },

  // Address
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Brand.border,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
  },
  addAddressText: { fontSize: 14, fontWeight: '600', color: Brand.primary },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + Spacing.one,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Brand.borderLight,
    padding: Spacing.three,
    borderRadius: 12,
    marginBottom: Spacing.two,
  },
  addressCardSelected: { borderColor: Brand.primary, backgroundColor: Brand.surfaceAlt },
  addressRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  addressRadioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Brand.primary },
  addressInfo: { flex: 1, gap: 2 },
  addressLabel: { fontSize: 15, fontWeight: '700', color: Brand.text },
  addressText: { fontSize: 13, color: Brand.textSecondary },
  addressPhone: { fontSize: 13, color: Brand.textTertiary, marginTop: 2 },
  defaultBadge: {
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half + 1,
    borderRadius: 6,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  // Summary
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: Spacing.three,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  summaryItemName: { flex: 1, fontSize: 13, color: Brand.text },
  summaryItemQty: { fontSize: 13, color: Brand.textTertiary, marginHorizontal: 8 },
  summaryItemPrice: { fontSize: 13, fontWeight: '600', color: Brand.text },
  divider: { height: 1, backgroundColor: Brand.borderLight, marginVertical: Spacing.two },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryRowLabel: { fontSize: 14, color: Brand.textSecondary },
  summaryRowValue: { fontSize: 14, fontWeight: '600', color: Brand.text },
  totalLabel: { fontSize: 16, fontWeight: '700', color: Brand.text },
  totalValue: { fontSize: 16, fontWeight: '800', color: Brand.primary },

  // Coupon
  couponRow: { flexDirection: 'row', gap: Spacing.two },
  couponInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
    fontSize: 15,
    color: Brand.text,
  },
  couponBtn: {
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.four,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  couponBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  couponMsg: { marginTop: Spacing.two, fontSize: 13, fontWeight: '600', color: Brand.primary },

  // Payment
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Brand.borderLight,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    marginBottom: Spacing.two,
  },
  paymentCardSelected: { borderColor: Brand.primary, backgroundColor: Brand.surfaceAlt },
  paymentIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Brand.text },
  paymentRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentRadioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Brand.primary },

  // Phone
  phoneWrap: { marginTop: Spacing.two },
  phoneLabel: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary, marginBottom: Spacing.one + 2 },
  phoneInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
    fontSize: 15,
    color: Brand.text,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    borderTopWidth: 1,
    borderTopColor: Brand.borderLight,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
  },
  footerTotal: { gap: 2 },
  footerTotalLabel: { fontSize: 12, color: Brand.textTertiary },
  footerTotalValue: { fontSize: 18, fontWeight: '800', color: Brand.primary },
  placeOrderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: Brand.primary,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
    borderRadius: 12,
  },
  placeOrderBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
