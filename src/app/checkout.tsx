import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
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
import { useCart } from '@/context/CartContext';
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

const PAYMENT_OPTIONS: {
  method: string;
  label: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  requiresPhone: boolean;
  color: string;
  bgColor: string;
}[] = [
    {
      method: 'mtn_momo',
      label: 'MTN MoMo',
      subtitle: 'Pay with MTN mobile money',
      icon: 'cellphone',
      requiresPhone: true,
      color: '#FFCC00',
      bgColor: '#FFCC0015',
    },
    {
      method: 'airtel_money',
      label: 'Airtel Money',
      subtitle: 'Pay with Airtel mobile money',
      icon: 'cellphone-link',
      requiresPhone: true,
      color: '#E40000',
      bgColor: '#E4000015',
    },
    {
      method: 'paypal',
      label: 'PayPal',
      subtitle: 'Secure online payment',
      icon: 'credit-card-outline',
      requiresPhone: false,
      color: '#003087',
      bgColor: '#00308715',
    },
    {
      method: 'cod',
      label: 'Cash on Delivery',
      subtitle: 'Pay when you receive',
      icon: 'cash',
      requiresPhone: false,
      color: Brand.primary,
      bgColor: Brand.primary + '15',
    },
  ];

const SHIPPING_FEE = 5000;
const TAX_RATE = 0.0;

export default function CheckoutScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { setCartCount: setGlobalCartCount } = useCart();

  const [cart, setCart] = useState<CartType | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('mtn_momo');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [orderNote, setOrderNote] = useState<string>('');
  const [couponCode, setCouponCode] = useState<string>('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [successOrder, setSuccessOrder] = useState<{ id: number; order_number: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadCheckout = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      // Load cart independently - failure here shouldn't break the whole page
      try {
        const cartData = await getCart();
        setCart(cartData);
      } catch (e: any) {
        console.error('Cart load error:', e?.message);
        setCart({ id: 0, items: [], total_items: 0, total_price: '0', created_at: '', updated_at: '' } as CartType);
      }

      // Load addresses independently
      try {
        const raw = await apiRequest<{ results: Address[] } | Address[]>({ method: 'GET', url: '/auth/addresses/' });
        const addrData = Array.isArray(raw) ? raw : (raw.results || []);
        setAddresses(addrData);
        const defaultAddr = addrData.find((a) => a.is_default) || addrData[0];
        if (defaultAddr) setSelectedAddressId(defaultAddr.id);
      } catch (e: any) {
        console.error('Address load error:', e?.message);
        setAddresses([]);
      }

      if (user?.phone) setPhoneNumber(user.phone);

      // Payment methods are optional - fallback to hardcoded options
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedMethod, user?.phone]);

  useEffect(() => {
    loadCheckout();
  }, [loadCheckout]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const showSuccess = (order: { id: number; order_number: string }) => {
    setSuccessOrder(order);
    setSuccessVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

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
          text: `Coupon applied - UGX ${calcDiscount.toLocaleString()} off`,
        });
      }
    } catch (e: any) {
      setDiscount(0);
      const status = e?.response?.status;
      if (status === 401) {
        setCouponMsg({ type: 'error', text: 'Please sign in again to use coupons' });
      } else if (status === 404) {
        setCouponMsg({ type: 'error', text: 'Invalid or expired coupon code' });
      } else {
        setCouponMsg({ type: 'error', text: e?.message || 'Failed to validate coupon' });
      }
    } finally {
      setCouponLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!cart || cart.items.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty.');
      return;
    }
    const selectedAddr = addresses.find((a) => a.id === selectedAddressId);
    if (!selectedAddr) {
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
      // Send the full shipping_address dict — the backend expects this, not address_id
      const shippingAddress = {
        street: selectedAddr.street || '',
        city: selectedAddr.city || '',
        state: selectedAddr.state || '',
        postal_code: selectedAddr.postal_code || '',
        country: selectedAddr.country || '',
        phone: selectedAddr.phone || phoneNumber || '',
      };

      const order = await apiRequest<{ id: number; order_number: string }>({
        method: 'POST',
        url: '/orders/create/',
        data: {
          shipping_address: shippingAddress,
          notes: orderNote || undefined,
        },
      });

      // Initiate payment as a separate step
      try {
        const initResult = await initiatePayment({
          order_id: order.id,
          method: selectedMethod,
          phone: opt?.requiresPhone ? phoneNumber.trim() : undefined,
          return_url: Linking.createURL('/checkout'),
        });

        if (selectedMethod === 'paypal' && initResult.redirect_url) {
          Linking.openURL(initResult.redirect_url);
          Alert.alert(
            'PayPal',
            'Complete your PayPal payment in the browser. We will verify your payment status.',
            [{ text: 'OK', onPress: () => pollPaymentStatus(order.id, initResult.payment_id) }]
          );
        } else if (opt?.requiresPhone) {
          Alert.alert(
            'Payment Sent',
            `A payment request was sent to ${phoneNumber}. Approve it on your phone to complete the order.`,
            [{ text: 'OK', onPress: () => pollPaymentStatus(order.id, initResult.payment_id) }]
          );
        } else {
          await clearCart();
          setGlobalCartCount(0);
          showSuccess(order);
        }
      } catch (payErr: any) {
        // Order was created but payment failed — still clear cart and show order
        const payStatus = payErr?.response?.status;
        let payMsg = payErr?.response?.data?.detail || payErr?.message || 'Payment could not be initiated.';
        if (payStatus === 400) {
          payMsg = payErr?.response?.data?.detail || 'Payment method unavailable. Your order is placed — pay from your orders page.';
        }
        await clearCart();
        setGlobalCartCount(0);
        Alert.alert(
          'Order Placed',
          `Your order #${order.order_number || order.id} was placed, but payment could not be initiated. ${payMsg}`,
          [{ text: 'View Order', onPress: () => router.replace(`/buyer/orders/${order.id}` as any) }]
        );
      }
    } catch (e: any) {
      const status = e?.response?.status;
      let msg = e?.message || 'Failed to place order';
      if (status === 401) {
        msg = 'Your session has expired. Please sign in again to place your order.';
      } else if (status === 400) {
        msg = e?.response?.data?.detail || e?.response?.data?.error || 'Invalid order data. Please check your details.';
      } else if (status === 404) {
        msg = 'Some items in your cart are no longer available. Please refresh your cart.';
      }
      setError(msg);
      Alert.alert('Checkout Error', msg);
    } finally {
      setPlacing(false);
    }
  };

  const pollPaymentStatus = (orderId: number, paymentId: number) => {
    setPlacing(true);
    let attempts = 0;
    const maxAttempts = 30;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const status = await checkPaymentStatus(paymentId);
        if (status.status === 'completed' || status.status === 'success') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          await clearCart();
          setGlobalCartCount(0);
          setPlacing(false);
          showSuccess({ id: orderId, order_number: '' });
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
        // ignore transient errors
      }
    }, 5000);
  };

  const selectedOpt = PAYMENT_OPTIONS.find((o) => o.method === selectedMethod);
  const currency = cart?.items[0]?.product.currency || 'UGX';
  const itemCount = cart?.items.reduce((s, i) => s + i.quantity, 0) || 0;

  const toggleSummary = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSummaryExpanded(!summaryExpanded);
  };

  const renderHeader = () => (
    <LinearGradient
      colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
      </Pressable>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>Checkout</Text>
        <Text style={styles.headerSub}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
      </View>
      <View style={{ width: 24 }} />
    </LinearGradient>
  );

  // Loading state
  if (loading) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          {renderHeader()}
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading checkout...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Sign-in required state
  if (!isAuthenticated) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          {renderHeader()}
          <View style={styles.centerBody}>
            <View style={styles.lockCircle}>
              <MaterialCommunityIcons name="lock-outline" size={48} color="#FFFFFF" />
            </View>
            <Text style={styles.errorText}>Sign In Required</Text>
            <Text style={styles.loadingText}>
              You need an account to place an order.{'\n'}Your cart items will be saved.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(auth)/login' as any)}
            >
              <MaterialCommunityIcons name="login" size={20} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Sign In</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/(auth)/register' as any)}
            >
              <Text style={styles.secondaryBtnText}>Create Account</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Error state (only if everything failed)
  if (error && !cart) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          {renderHeader()}
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={56} color={Brand.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
              onPress={loadCheckout}
            >
              <Text style={styles.primaryBtnText}>Retry</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {renderHeader()}

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={80}
        >
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Step 1: Delivery Address */}
            <View style={styles.stepSection}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepTitle}>Delivery Address</Text>
                {addresses.length > 0 && (
                  <Pressable
                    style={styles.stepAddBtn}
                    onPress={() => router.push('/buyer/addresses' as any)}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color={Brand.primary} />
                  </Pressable>
                )}
              </View>

              {addresses.length === 0 ? (
                <Pressable
                  style={({ pressed }) => [styles.addAddressCard, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push('/buyer/addresses' as any)}
                >
                  <View style={styles.addAddressIcon}>
                    <MaterialCommunityIcons name="map-marker-plus" size={32} color={Brand.primary} />
                  </View>
                  <Text style={styles.addAddressTitle}>Add a delivery address</Text>
                  <Text style={styles.addAddressSub}>Tap here to add your first address</Text>
                </Pressable>
              ) : (
                <View style={styles.addressList}>
                  {addresses.map((addr) => {
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
                          <View style={styles.addressLabelRow}>
                            <Text style={styles.addressLabel}>{addr.label}</Text>
                            {addr.is_default && (
                              <View style={styles.defaultBadge}>
                                <MaterialCommunityIcons name="star" size={10} color="#FFFFFF" />
                                <Text style={styles.defaultBadgeText}>Default</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.addressText} numberOfLines={2}>
                            {addr.street}, {addr.city}, {addr.state}
                          </Text>
                          <Text style={styles.addressCountry}>{addr.country}</Text>
                          <View style={styles.addressPhoneRow}>
                            <MaterialCommunityIcons name="phone-outline" size={13} color={Brand.primary} />
                            <Text style={styles.addressPhone}>{addr.phone}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Delivery notes */}
            <View style={styles.noteSection}>
              <Text style={styles.noteLabel}>Delivery notes (optional)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="e.g. Call me when you arrive, leave at the gate..."
                placeholderTextColor={Brand.textTertiary}
                value={orderNote}
                onChangeText={setOrderNote}
                multiline
                maxLength={200}
                textAlignVertical="top"
              />
            </View>

            {/* Step 2: Payment Method */}
            <View style={styles.stepSection}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepTitle}>Payment Method</Text>
              </View>

              <View style={styles.paymentList}>
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
                      <View style={[styles.paymentIcon, { backgroundColor: opt.bgColor }]}>
                        <MaterialCommunityIcons name={opt.icon} size={24} color={opt.color} />
                      </View>
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentLabel}>{opt.label}</Text>
                        <Text style={styles.paymentSub}>{opt.subtitle}</Text>
                      </View>
                      <View style={styles.paymentRadio}>
                        {selected && <View style={styles.paymentRadioDot} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {selectedOpt?.requiresPhone && (
                <View style={styles.phoneSection}>
                  <Text style={styles.phoneLabel}>MoMo Phone Number</Text>
                  <View style={styles.phoneInputWrap}>
                    <MaterialCommunityIcons name="phone-outline" size={20} color={Brand.primary} />
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="07XXXXXXXX"
                      placeholderTextColor={Brand.textTertiary}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Step 3: Order Summary (collapsible) */}
            <View style={styles.stepSection}>
              <Pressable
                style={({ pressed }) => [styles.summaryToggle, pressed && { opacity: 0.8 }]}
                onPress={toggleSummary}
              >
                <View style={styles.stepHeader}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <Text style={styles.stepTitle}>Order Summary</Text>
                </View>
                <View style={styles.summaryToggleRight}>
                  <Text style={styles.summaryItemCount}>
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </Text>
                  <MaterialCommunityIcons
                    name={summaryExpanded ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color={Brand.textTertiary}
                  />
                </View>
              </Pressable>

              <View style={styles.summaryMiniCard}>
                <View style={styles.summaryMiniRow}>
                  <Text style={styles.summaryMiniLabel}>Subtotal</Text>
                  <Text style={styles.summaryMiniValue}>{currency} {subtotal.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryMiniRow}>
                  <Text style={styles.summaryMiniLabel}>Shipping</Text>
                  <Text style={styles.summaryMiniValue}>{currency} {shipping.toLocaleString()}</Text>
                </View>
                {discount > 0 && (
                  <View style={styles.summaryMiniRow}>
                    <Text style={[styles.summaryMiniLabel, { color: Brand.primary }]}>Discount</Text>
                    <Text style={[styles.summaryMiniValue, { color: Brand.primary }]}>
                      -{currency} {discount.toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>

              {summaryExpanded && (
                <View style={styles.summaryExpandedCard}>
                  {cart?.items.map((item) => (
                    <View key={`ci-${item.id}`} style={styles.summaryItem}>
                      {item.product.primary_image_url ? (
                        <Image
                          source={{ uri: item.product.primary_image_url }}
                          style={styles.summaryItemImage}
                          contentFit="contain"
                        />
                      ) : (
                        <View style={[styles.summaryItemImage, styles.summaryNoImage]}>
                          <MaterialCommunityIcons name="package-variant-closed" size={16} color="#ccc" />
                        </View>
                      )}
                      <View style={styles.summaryItemInfo}>
                        <Text style={styles.summaryItemName} numberOfLines={2}>{item.product.name}</Text>
                        <Text style={styles.summaryItemStore} numberOfLines={1}>
                          {item.product.store?.name || ''}
                        </Text>
                      </View>
                      <View style={styles.summaryItemRight}>
                        <Text style={styles.summaryItemQty}>x{item.quantity}</Text>
                        <Text style={styles.summaryItemPrice}>{currency} {Number(item.total_price).toLocaleString()}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Coupon */}
              <View style={styles.couponSection}>
                <View style={styles.couponRow}>
                  <View style={styles.couponInputWrap}>
                    <MaterialCommunityIcons name="ticket-percent-outline" size={20} color={Brand.textTertiary} />
                    <TextInput
                      style={styles.couponInput}
                      placeholder="Coupon code"
                      placeholderTextColor={Brand.textTertiary}
                      value={couponCode}
                      onChangeText={setCouponCode}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.couponBtn, pressed && { opacity: 0.85 }]}
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
                  <View style={[styles.couponMsgWrap, couponMsg.type === 'error' && styles.couponMsgError]}>
                    <MaterialCommunityIcons
                      name={couponMsg.type === 'success' ? 'check-circle' : 'alert-circle'}
                      size={16}
                      color={couponMsg.type === 'success' ? Brand.primary : Brand.danger}
                    />
                    <Text style={[styles.couponMsg, couponMsg.type === 'error' && { color: Brand.danger }]}>
                      {couponMsg.text}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Sticky footer */}
          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <Text style={styles.footerLabel}>Total</Text>
              <View style={styles.footerTotalRow}>
                <Text style={styles.footerCurrency}>{currency}</Text>
                <Text style={styles.footerTotalValue}>{total.toLocaleString()}</Text>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.placeOrderBtn,
                (placing || !cart || cart.items.length === 0 || !selectedAddressId) && styles.placeOrderBtnDisabled,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handlePlaceOrder}
              disabled={placing || !cart || cart.items.length === 0 || !selectedAddressId}
            >
              {placing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.placeOrderBtnText}>Place Order</Text>
                  <MaterialCommunityIcons name="arrow-right" size={22} color="#FFFFFF" />
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Success overlay */}
      {successVisible && successOrder && (
        <Animated.View style={[styles.successOverlay, { opacity: fadeAnim }]}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <LinearGradient
                colors={[Brand.primaryDark, Brand.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.successIconCircle}
              >
                <MaterialCommunityIcons name="check" size={48} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={styles.successTitle}>Order Placed!</Text>
            <Text style={styles.successSub}>
              {successOrder.order_number
                ? `Order #${successOrder.order_number}`
                : 'Your order has been placed successfully'}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.successBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                setSuccessVisible(false);
                router.replace(`/buyer/orders/${successOrder.id}` as any);
              }}
            >
              <Text style={styles.successBtnText}>View Order</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.successSecondary, pressed && { opacity: 0.7 }]}
              onPress={() => {
                setSuccessVisible(false);
                router.replace('/');
              }}
            >
              <Text style={styles.successSecondaryText}>Continue Shopping</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F6F8' },
  safeArea: { flex: 1, backgroundColor: Brand.primary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.four },
  loadingText: { marginTop: Spacing.two, fontSize: 14, color: Brand.textSecondary, textAlign: 'center', lineHeight: 20 },
  errorText: { marginTop: Spacing.two, fontSize: 18, fontWeight: '700', color: Brand.danger, textAlign: 'center' },
  lockCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: Brand.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.four + Spacing.two,
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 4,
    shadowColor: Brand.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  secondaryBtn: { marginTop: Spacing.two + 2 },
  secondaryBtnText: { color: Brand.primary, fontWeight: '700', fontSize: 15 },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.two + 2, paddingBottom: 120, gap: Spacing.two + 2 },

  stepSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: Spacing.three,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two + 2,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  stepTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: Brand.text },
  stepAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Brand.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },

  addAddressCard: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.one + 2,
    backgroundColor: Brand.primary + '08',
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Brand.primary + '40',
  },
  addAddressIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Brand.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addAddressTitle: { fontSize: 15, fontWeight: '700', color: Brand.primary },
  addAddressSub: { fontSize: 13, color: Brand.textTertiary },

  addressList: { gap: Spacing.two },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + Spacing.one,
    backgroundColor: '#FAFBFC',
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    padding: Spacing.two + 2,
    borderRadius: 14,
  },
  addressCardSelected: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primary + '08',
    borderWidth: 2,
  },
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
  addressInfo: { flex: 1, gap: 3 },
  addressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  addressLabel: { fontSize: 15, fontWeight: '800', color: Brand.text },
  addressText: { fontSize: 13, color: Brand.textSecondary, lineHeight: 18 },
  addressCountry: { fontSize: 12, color: Brand.textTertiary },
  addressPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  addressPhone: { fontSize: 13, color: Brand.primary, fontWeight: '600' },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  noteSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: Spacing.three,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  noteLabel: { fontSize: 14, fontWeight: '700', color: Brand.text, marginBottom: Spacing.two },
  noteInput: {
    backgroundColor: '#F5F6F8',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 14,
    color: Brand.text,
    minHeight: 60,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },

  paymentList: { gap: Spacing.two },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
    backgroundColor: '#FAFBFC',
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
  },
  paymentCardSelected: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primary + '08',
    borderWidth: 2,
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentInfo: { flex: 1, gap: 2 },
  paymentLabel: { fontSize: 15, fontWeight: '700', color: Brand.text },
  paymentSub: { fontSize: 12, color: Brand.textTertiary },
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

  phoneSection: { marginTop: Spacing.two + 2 },
  phoneLabel: { fontSize: 13, fontWeight: '700', color: Brand.textSecondary, marginBottom: Spacing.one + 2 },
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#F5F6F8',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
  },
  phoneInput: {
    flex: 1,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
    fontSize: 15,
    color: Brand.text,
    fontWeight: '600',
  },

  summaryToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryToggleRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  summaryItemCount: { fontSize: 13, color: Brand.textTertiary, fontWeight: '600' },

  summaryMiniCard: {
    backgroundColor: '#F5F6F8',
    borderRadius: 12,
    padding: Spacing.two + 2,
    gap: 6,
  },
  summaryMiniRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryMiniLabel: { fontSize: 14, color: Brand.textSecondary },
  summaryMiniValue: { fontSize: 14, fontWeight: '600', color: Brand.text },

  summaryExpandedCard: {
    marginTop: Spacing.two,
    backgroundColor: '#FAFBFC',
    borderRadius: 12,
    padding: Spacing.two + 2,
    gap: Spacing.one + 2,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  summaryItemImage: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F0F0F0' },
  summaryNoImage: { justifyContent: 'center', alignItems: 'center' },
  summaryItemInfo: { flex: 1, gap: 2 },
  summaryItemName: { fontSize: 13, color: Brand.text, fontWeight: '600', lineHeight: 17 },
  summaryItemStore: { fontSize: 11, color: Brand.textTertiary },
  summaryItemRight: { alignItems: 'flex-end', gap: 2 },
  summaryItemQty: { fontSize: 12, color: Brand.textTertiary, fontWeight: '600' },
  summaryItemPrice: { fontSize: 13, fontWeight: '700', color: Brand.text },

  couponSection: { marginTop: Spacing.two + 2 },
  couponRow: { flexDirection: 'row', gap: Spacing.two },
  couponInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#F5F6F8',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
  },
  couponInput: {
    flex: 1,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
    fontSize: 15,
    color: Brand.text,
    fontWeight: '600',
  },
  couponBtn: {
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  couponBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  couponMsgWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
    backgroundColor: Brand.primary + '12',
    borderRadius: 10,
  },
  couponMsgError: { backgroundColor: Brand.danger + '12' },
  couponMsg: { fontSize: 13, fontWeight: '600', color: Brand.primary, flex: 1 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    paddingBottom: Platform.select({ ios: Spacing.two + 6, android: Spacing.two + 2 }),
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },
  footerLeft: { gap: 2 },
  footerLabel: { fontSize: 12, color: Brand.textTertiary, fontWeight: '600' },
  footerTotalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  footerCurrency: { fontSize: 13, fontWeight: '700', color: Brand.primary },
  footerTotalValue: { fontSize: 22, fontWeight: '900', color: Brand.primary },
  placeOrderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: Brand.primary,
    paddingVertical: Platform.select({ ios: 16, android: 14 }),
    borderRadius: 14,
    elevation: 4,
    shadowColor: Brand.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  placeOrderBtnDisabled: { opacity: 0.5 },
  placeOrderBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },

  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: Spacing.four + Spacing.two,
    alignItems: 'center',
    marginHorizontal: Spacing.four + Spacing.two,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  successIconWrap: { marginBottom: Spacing.three },
  successIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: { fontSize: 22, fontWeight: '900', color: Brand.text },
  successSub: { fontSize: 14, color: Brand.textSecondary, marginTop: Spacing.one, textAlign: 'center' },
  successBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.four + Spacing.two,
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 4,
    shadowColor: Brand.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  successBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  successSecondary: { marginTop: Spacing.two + 2 },
  successSecondaryText: { color: Brand.textSecondary, fontWeight: '600', fontSize: 15 },
});
