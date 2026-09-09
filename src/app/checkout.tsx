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
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { apiRequest } from '@/services/api';
import { clearCart, getCart } from '@/services/cart';
import { validateCoupon } from '@/services/catalog';
import {
  fetchPickupStations,
  type PickUpStation,
} from '@/services/logistics';
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
      bgColor: '#FFCC0012',
    },
    {
      method: 'airtel_money',
      label: 'Airtel Money',
      subtitle: 'Pay with Airtel mobile money',
      icon: 'cellphone-link',
      requiresPhone: true,
      color: '#E40000',
      bgColor: '#E4000012',
    },
    {
      method: 'paypal',
      label: 'PayPal',
      subtitle: 'Secure online payment',
      icon: 'credit-card-outline',
      requiresPhone: false,
      color: '#003087',
      bgColor: '#00308712',
    },
    {
      method: 'cod',
      label: 'Cash on Delivery',
      subtitle: 'Pay when you receive',
      icon: 'cash',
      requiresPhone: false,
      color: Brand.primary,
      bgColor: Brand.primary + '12',
    },
  ];

const SHIPPING_FEE = 5000;
const TAX_RATE = 0.0;
const REGIONS = ['Central', 'Northern', 'West Nile'];

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
  const [successVisible, setSuccessVisible] = useState(false);
  const [successOrder, setSuccessOrder] = useState<{ id: number; order_number: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const selectedMethodRef = useRef(selectedMethod);
  selectedMethodRef.current = selectedMethod;

  // Fulfillment method + pickup station state
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'home_delivery' | 'pickup_station'>('home_delivery');
  const [pickupStations, setPickupStations] = useState<PickUpStation[]>([]);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('Central');
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);

  const loadCheckout = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      try {
        const cartData = await getCart();
        setCart(cartData);
      } catch (e: any) {
        console.error('Cart load error:', e?.message);
        setCart({ id: 0, items: [], total_items: 0, total_price: '0', created_at: '', updated_at: '' } as CartType);
      }

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

      try {
        const methods = await fetchPaymentMethods();
        setPaymentMethods(methods);
        if (methods.length > 0 && !methods.find((m) => m.method === selectedMethodRef.current)) {
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
  }, [isAuthenticated, user?.phone]);

  useEffect(() => {
    loadCheckout();
  }, [loadCheckout]);

  // Fetch pickup stations when user switches to pickup fulfillment
  useEffect(() => {
    if (fulfillmentMethod === 'pickup_station' && pickupStations.length === 0 && !pickupLoading) {
      loadPickupStations();
    }
  }, [fulfillmentMethod, pickupStations.length, pickupLoading]);

  const loadPickupStations = useCallback(async () => {
    setPickupLoading(true);
    setPickupError(null);
    try {
      const stations = await fetchPickupStations();
      setPickupStations(stations);
    } catch (e: any) {
      setPickupError(e?.message || 'Failed to load pickup stations');
    } finally {
      setPickupLoading(false);
    }
  }, []);

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
          text: `Min order UGX ${result.min_order_amount.toLocaleString()}`,
        });
        setDiscount(0);
      } else {
        setDiscount(calcDiscount);
        setCouponMsg({
          type: 'success',
          text: `−UGX ${calcDiscount.toLocaleString()} applied`,
        });
      }
    } catch (e: any) {
      setDiscount(0);
      const status = e?.response?.status;
      if (status === 401) {
        setCouponMsg({ type: 'error', text: 'Sign in again to use coupons' });
      } else if (status === 404) {
        setCouponMsg({ type: 'error', text: 'Invalid or expired code' });
      } else {
        setCouponMsg({ type: 'error', text: e?.message || 'Failed to validate' });
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

  const selectedStation = pickupStations.find(s => s.id === selectedStationId);
  const regionStations = pickupStations.filter(s => s.region === selectedRegion && s.is_active);

  // ── Header ──────────────────────────────────────────────────────
  const renderHeader = () => (
    <LinearGradient
      colors={[Brand.dark, Brand.accent, Brand.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
      </Pressable>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>Checkout</Text>
        <Text style={styles.headerSub}>{itemCount} {itemCount === 1 ? 'item' : 'items'} · {currency} {subtotal.toLocaleString()}</Text>
      </View>
      <View style={styles.headerBadge}>
        <MaterialCommunityIcons name="shield-check-outline" size={16} color="#FFFFFF" />
      </View>
    </LinearGradient>
  );

  // ── Loading state ────────────────────────────────────────────────
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

  // ── Sign-in required ─────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          {renderHeader()}
          <View style={styles.centerBody}>
            <View style={styles.lockCircle}>
              <MaterialCommunityIcons name="lock-outline" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.errorText}>Sign In Required</Text>
            <Text style={styles.loadingText}>
              You need an account to place an order.{'\n'}Your cart items will be saved.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(auth)/login' as any)}
            >
              <MaterialCommunityIcons name="login" size={18} color="#FFFFFF" />
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

  // ── Error state ──────────────────────────────────────────────────
  if (error && !cart) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          {renderHeader()}
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
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
            {/* ── Section 1: Delivery Address + Notes ─────────────── */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.stepPill}>
                  <Text style={styles.stepPillText}>1</Text>
                </View>
                <Text style={styles.cardTitle}>Delivery Address</Text>
                {addresses.length > 0 && (
                  <Pressable
                    style={styles.cardAction}
                    onPress={() => router.push('/buyer/addresses' as any)}
                  >
                    <MaterialCommunityIcons name="plus" size={16} color={Brand.primary} />
                  </Pressable>
                )}
              </View>

              {addresses.length === 0 ? (
                <Pressable
                  style={({ pressed }) => [styles.addAddressCard, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push('/buyer/addresses' as any)}
                >
                  <MaterialCommunityIcons name="map-marker-plus" size={28} color={Brand.primary} />
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
                        <View style={[styles.radio, selected && styles.radioSelected]}>
                          {selected && <View style={styles.radioDot} />}
                        </View>
                        <View style={styles.addressInfo}>
                          <View style={styles.addressLabelRow}>
                            <Text style={styles.addressLabel}>{addr.label}</Text>
                            {addr.is_default && (
                              <View style={styles.defaultBadge}>
                                <Text style={styles.defaultBadgeText}>Default</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.addressText} numberOfLines={2}>
                            {addr.street}, {addr.city}, {addr.state}
                          </Text>
                          <View style={styles.addressPhoneRow}>
                            <MaterialCommunityIcons name="phone-outline" size={11} color={Brand.primary} />
                            <Text style={styles.addressPhone}>{addr.phone}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Inline delivery notes */}
              <View style={styles.notesWrap}>
                <MaterialCommunityIcons name="note-text-outline" size={16} color={Brand.textTertiary} />
                <TextInput
                  style={styles.notesInput}
                  placeholder="Delivery notes (optional)..."
                  placeholderTextColor={Brand.textTertiary}
                  value={orderNote}
                  onChangeText={setOrderNote}
                  maxLength={200}
                />
              </View>
            </View>

            {/* ── Section 2: Delivery Method + Pickup Station ─────── */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.stepPill}>
                  <Text style={styles.stepPillText}>2</Text>
                </View>
                <Text style={styles.cardTitle}>Delivery Method</Text>
              </View>

              {/* Fulfillment toggle — compact horizontal pills */}
              <View style={styles.fulfillmentRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.fulfillmentPill,
                    fulfillmentMethod === 'home_delivery' && styles.fulfillmentPillActive,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => setFulfillmentMethod('home_delivery')}
                >
                  <MaterialCommunityIcons
                    name="truck"
                    size={18}
                    color={fulfillmentMethod === 'home_delivery' ? '#FFFFFF' : Brand.textTertiary}
                  />
                  <Text style={[
                    styles.fulfillmentPillText,
                    fulfillmentMethod === 'home_delivery' && styles.fulfillmentPillTextActive,
                  ]}>Home Delivery</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.fulfillmentPill,
                    fulfillmentMethod === 'pickup_station' && styles.fulfillmentPillActive,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => setFulfillmentMethod('pickup_station')}
                >
                  <MaterialCommunityIcons
                    name="store"
                    size={18}
                    color={fulfillmentMethod === 'pickup_station' ? '#FFFFFF' : Brand.textTertiary}
                  />
                  <Text style={[
                    styles.fulfillmentPillText,
                    fulfillmentMethod === 'pickup_station' && styles.fulfillmentPillTextActive,
                  ]}>Pickup Station</Text>
                </Pressable>
              </View>

              {/* Pickup Station Selector */}
              {fulfillmentMethod === 'pickup_station' && (
                <View style={styles.pickupSection}>
                  {/* Region Tabs */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.regionTabsScroll}
                    contentContainerStyle={styles.regionTabsContent}
                  >
                    {REGIONS.map((region) => (
                      <Pressable
                        key={`region-${region}`}
                        style={({ pressed }) => [
                          styles.regionTab,
                          selectedRegion === region && styles.regionTabActive,
                          pressed && { opacity: 0.85 },
                        ]}
                        onPress={() => setSelectedRegion(region)}
                      >
                        <MaterialCommunityIcons
                          name="map-marker"
                          size={12}
                          color={selectedRegion === region ? '#FFFFFF' : Brand.textTertiary}
                        />
                        <Text style={[
                          styles.regionTabText,
                          selectedRegion === region && styles.regionTabTextActive,
                        ]}>{region}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {/* Loading state */}
                  {pickupLoading && (
                    <View style={styles.pickupLoading}>
                      <ActivityIndicator size="small" color={Brand.primary} />
                      <Text style={styles.pickupLoadingText}>Loading stations...</Text>
                    </View>
                  )}

                  {/* Error state */}
                  {pickupError && !pickupLoading && (
                    <View style={styles.pickupError}>
                      <MaterialCommunityIcons name="alert-circle-outline" size={16} color={Brand.danger} />
                      <Text style={styles.pickupErrorText}>{pickupError}</Text>
                      <Pressable style={styles.pickupRetryBtn} onPress={loadPickupStations}>
                        <Text style={styles.pickupRetryText}>Retry</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Station Cards */}
                  {!pickupLoading && !pickupError && (
                    <View style={styles.stationList}>
                      {regionStations.map((station) => {
                        const selected = station.id === selectedStationId;
                        return (
                          <Pressable
                            key={`station-${station.id}`}
                            style={({ pressed }) => [
                              styles.stationCard,
                              selected && styles.stationCardSelected,
                              pressed && { opacity: 0.85 },
                            ]}
                            onPress={() => setSelectedStationId(station.id)}
                          >
                            <View style={[
                              styles.stationCardIcon,
                              selected && styles.stationCardIconSelected,
                            ]}>
                              <MaterialCommunityIcons
                                name="store"
                                size={16}
                                color={selected ? '#FFFFFF' : Brand.primary}
                              />
                            </View>
                            <View style={styles.stationCardBody}>
                              <Text style={styles.stationCardName} numberOfLines={1}>
                                {station.name}
                              </Text>
                              <Text style={styles.stationCardMeta} numberOfLines={1}>
                                {station.city} · {station.operating_hours || 'Hours N/A'}
                              </Text>
                            </View>
                            {selected && (
                              <MaterialCommunityIcons name="check-circle" size={18} color={Brand.primary} />
                            )}
                          </Pressable>
                        );
                      })}
                      {regionStations.length === 0 && (
                        <View style={styles.stationEmpty}>
                          <MaterialCommunityIcons name="store-off-outline" size={28} color={Brand.textTertiary} />
                          <Text style={styles.stationEmptyText}>
                            No pickup stations in this region
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Selected station detail */}
                  {selectedStation && !pickupLoading && !pickupError && (
                    <View style={styles.stationDetail}>
                      <View style={styles.stationDetailHeader}>
                        <MaterialCommunityIcons name="store" size={16} color="#FFFFFF" />
                        <Text style={styles.stationDetailName} numberOfLines={1}>
                          {selectedStation.name}
                        </Text>
                        <Pressable
                          style={styles.stationDetailClose}
                          onPress={() => setSelectedStationId(null)}
                        >
                          <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                        </Pressable>
                      </View>
                      <View style={styles.stationDetailBody}>
                        <View style={styles.stationDetailRow}>
                          <MaterialCommunityIcons name="map-marker" size={12} color={Brand.primary} />
                          <Text style={styles.stationDetailText} numberOfLines={2}>
                            {selectedStation.full_address || selectedStation.address_line_1}
                          </Text>
                        </View>
                        {selectedStation.contact_number && (
                          <View style={styles.stationDetailRow}>
                            <MaterialCommunityIcons name="phone-outline" size={12} color={Brand.primary} />
                            <Text style={styles.stationDetailText}>{selectedStation.contact_number}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* ── Section 3: Payment Method ──────────────────────── */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.stepPill}>
                  <Text style={styles.stepPillText}>3</Text>
                </View>
                <Text style={styles.cardTitle}>Payment Method</Text>
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
                        <MaterialCommunityIcons name={opt.icon} size={20} color={opt.color} />
                      </View>
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentLabel}>{opt.label}</Text>
                        <Text style={styles.paymentSub}>{opt.subtitle}</Text>
                      </View>
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected && <View style={styles.radioDot} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {selectedOpt?.requiresPhone && (
                <View style={styles.phoneSection}>
                  <View style={styles.phoneInputWrap}>
                    <MaterialCommunityIcons name="phone-outline" size={18} color={Brand.primary} />
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

            {/* ── Section 4: Order Summary ─────────────────────── */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.stepPill}>
                  <Text style={styles.stepPillText}>4</Text>
                </View>
                <Text style={styles.cardTitle}>Order Summary</Text>
                <View style={styles.itemCountBadge}>
                  <Text style={styles.itemCountBadgeText}>
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </Text>
                </View>
              </View>

              {/* Product list — always visible */}
              {cart && cart.items.length > 0 && (
                <View style={styles.productList}>
                  {cart.items.map((item) => (
                    <View key={`ci-${item.id}`} style={styles.productItem}>
                      {item.product.primary_image_url ? (
                        <Image
                          source={{ uri: item.product.primary_image_url }}
                          style={styles.productItemImage}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.productItemImage, styles.productNoImage]}>
                          <MaterialCommunityIcons name="package-variant-closed" size={16} color="#bbb" />
                        </View>
                      )}
                      <View style={styles.productItemInfo}>
                        <Text style={styles.productItemName} numberOfLines={2}>{item.product.name}</Text>
                        {item.product.store?.name ? (
                          <Text style={styles.productItemStore} numberOfLines={1}>
                            {item.product.store.name}
                          </Text>
                        ) : null}
                        <View style={styles.productItemBottom}>
                          <Text style={styles.productItemQty}>Qty {item.quantity}</Text>
                          <Text style={styles.productItemPrice}>{currency} {Number(item.total_price).toLocaleString()}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Cost breakdown */}
              <View style={styles.costBreakdown}>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>Subtotal</Text>
                  <Text style={styles.costValue}>{currency} {subtotal.toLocaleString()}</Text>
                </View>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>Shipping</Text>
                  <Text style={styles.costValue}>{currency} {shipping.toLocaleString()}</Text>
                </View>
                {discount > 0 && (
                  <View style={styles.costRow}>
                    <Text style={[styles.costLabel, { color: Brand.primary }]}>Discount</Text>
                    <Text style={[styles.costValue, { color: Brand.primary }]}>
                      −{currency} {discount.toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>

              {/* Total bar */}
              <View style={styles.totalBar}>
                <Text style={styles.totalBarLabel}>Total</Text>
                <Text style={styles.totalBarValue}>{currency} {total.toLocaleString()}</Text>
              </View>

              {/* Coupon */}
              <View style={styles.couponRow}>
                <View style={styles.couponInputWrap}>
                  <MaterialCommunityIcons name="ticket-percent-outline" size={16} color={Brand.textTertiary} />
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
                    size={14}
                    color={couponMsg.type === 'success' ? Brand.primary : Brand.danger}
                  />
                  <Text style={[styles.couponMsg, couponMsg.type === 'error' && { color: Brand.danger }]}>
                    {couponMsg.text}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* ── Sticky footer ──────────────────────────────────── */}
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
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ── Success overlay ────────────────────────────────────── */}
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
                <MaterialCommunityIcons name="check" size={44} color="#FFFFFF" />
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
              <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
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

// ═══════════════════════════════════════════════════════════════════
//  Styles — Compact Modern Design
// ═══════════════════════════════════════════════════════════════════
const RADIUS = 14;
const RADIUS_SM = 10;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.dark },

  // ── Header ──────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  headerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Center states ───────────────────────────────────────────
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.four },
  loadingText: { marginTop: Spacing.two, fontSize: 14, color: Brand.textSecondary, textAlign: 'center', lineHeight: 20 },
  errorText: { marginTop: Spacing.two, fontSize: 17, fontWeight: '700', color: Brand.danger, textAlign: 'center' },
  lockCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
    paddingVertical: 13,
    borderRadius: RADIUS,
    elevation: 4,
    shadowColor: Brand.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  secondaryBtn: { marginTop: Spacing.two + 2 },
  secondaryBtnText: { color: Brand.primary, fontWeight: '700', fontSize: 15 },

  // ── Body ────────────────────────────────────────────────────
  body: { flex: 1 },
  bodyContent: { padding: Spacing.two + 2, paddingBottom: 120, gap: Spacing.two + 2 },

  // ── Card (shared) ──────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS,
    padding: Spacing.three - 2,
    borderWidth: 1,
    borderColor: Brand.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two + 2,
  },
  stepPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Brand.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepPillText: { color: Brand.primary, fontWeight: '800', fontSize: 12 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: Brand.text },
  cardAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Brand.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Address ────────────────────────────────────────────────
  addAddressCard: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.one + 2,
    backgroundColor: Brand.primary + '06',
    borderRadius: RADIUS_SM,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Brand.primary + '30',
  },
  addAddressTitle: { fontSize: 14, fontWeight: '700', color: Brand.primary },
  addAddressSub: { fontSize: 12, color: Brand.textTertiary },

  addressList: { gap: Spacing.one + 2 },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + 2,
    backgroundColor: Brand.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Brand.borderLight,
    padding: Spacing.two + 2,
    borderRadius: RADIUS_SM,
  },
  addressCardSelected: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primary + '06',
    borderWidth: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  radioSelected: { borderColor: Brand.primary },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Brand.primary },
  addressInfo: { flex: 1, gap: 2 },
  addressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  addressLabel: { fontSize: 14, fontWeight: '700', color: Brand.text },
  addressText: { fontSize: 12, color: Brand.textSecondary, lineHeight: 16 },
  addressPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  addressPhone: { fontSize: 12, color: Brand.primary, fontWeight: '600' },
  defaultBadge: {
    backgroundColor: Brand.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  defaultBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },

  // ── Inline notes ────────────────────────────────────────────
  notesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    marginTop: Spacing.two + 2,
    backgroundColor: Brand.surfaceAlt,
    borderRadius: RADIUS_SM,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
    borderWidth: 1,
    borderColor: Brand.borderLight,
  },
  notesInput: {
    flex: 1,
    fontSize: 13,
    color: Brand.text,
    padding: 0,
  },

  // ── Fulfillment pills ──────────────────────────────────────
  fulfillmentRow: { flexDirection: 'row', gap: Spacing.one + 2 },
  fulfillmentPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one + 2,
    paddingVertical: Spacing.two + 2,
    borderRadius: RADIUS_SM,
    borderWidth: 1.5,
    borderColor: Brand.borderLight,
    backgroundColor: Brand.surfaceAlt,
  },
  fulfillmentPillActive: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primary,
  },
  fulfillmentPillText: { fontSize: 13, fontWeight: '700', color: Brand.textTertiary },
  fulfillmentPillTextActive: { color: '#FFFFFF' },

  // ── Pickup section ─────────────────────────────────────────
  pickupSection: { marginTop: Spacing.two + 2 },

  // Region tabs
  regionTabsScroll: { marginBottom: Spacing.two, flexGrow: 0 },
  regionTabsContent: { gap: 6, paddingRight: Spacing.two },
  regionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Brand.borderLight,
    backgroundColor: '#FFFFFF',
  },
  regionTabActive: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primary,
  },
  regionTabText: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  regionTabTextActive: { color: '#FFFFFF' },

  // Loading / error
  pickupLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  pickupLoadingText: { fontSize: 13, color: Brand.textTertiary },
  pickupError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: RADIUS_SM,
  },
  pickupErrorText: { flex: 1, fontSize: 12, color: '#B91C1C' },
  pickupRetryBtn: {
    backgroundColor: '#B91C1C',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  pickupRetryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },

  // Station cards
  stationList: { gap: Spacing.one + 2 },
  stationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Brand.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Brand.borderLight,
    padding: Spacing.two,
    borderRadius: RADIUS_SM,
  },
  stationCardSelected: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primary + '06',
    borderWidth: 2,
  },
  stationCardIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: Brand.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stationCardIconSelected: { backgroundColor: Brand.primary },
  stationCardBody: { flex: 1, gap: 1 },
  stationCardName: { fontSize: 13, fontWeight: '700', color: Brand.text },
  stationCardMeta: { fontSize: 11, color: Brand.textTertiary },
  stationEmpty: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  stationEmptyText: { fontSize: 13, color: Brand.textTertiary, textAlign: 'center' },

  // Station detail
  stationDetail: {
    marginTop: Spacing.two,
    borderRadius: RADIUS_SM,
    overflow: 'hidden',
    backgroundColor: Brand.primary + '06',
    borderWidth: 1,
    borderColor: Brand.primary + '20',
  },
  stationDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two - 2,
    backgroundColor: Brand.primary,
  },
  stationDetailName: { flex: 1, fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  stationDetailClose: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stationDetailBody: { paddingHorizontal: Spacing.two + 2, paddingVertical: Spacing.two, gap: 6 },
  stationDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  stationDetailText: { flex: 1, fontSize: 12, color: Brand.textSecondary },

  // ── Payment ────────────────────────────────────────────────
  paymentList: { gap: Spacing.one + 2 },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    backgroundColor: Brand.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Brand.borderLight,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two + 2,
    borderRadius: RADIUS_SM,
  },
  paymentCardSelected: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primary + '06',
    borderWidth: 2,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS_SM,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentInfo: { flex: 1, gap: 1 },
  paymentLabel: { fontSize: 14, fontWeight: '700', color: Brand.text },
  paymentSub: { fontSize: 11, color: Brand.textTertiary },

  // Phone input
  phoneSection: { marginTop: Spacing.two },
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    backgroundColor: Brand.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Brand.borderLight,
    borderRadius: RADIUS_SM,
    paddingHorizontal: Spacing.two + 2,
  },
  phoneInput: {
    flex: 1,
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
    fontSize: 14,
    color: Brand.text,
    fontWeight: '600',
  },

  // ── Summary ────────────────────────────────────────────────
  itemCountBadge: {
    backgroundColor: Brand.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  itemCountBadgeText: { fontSize: 11, fontWeight: '700', color: Brand.primary },

  // Product list — always visible
  productList: {
    gap: Spacing.one + 2,
    marginBottom: Spacing.two + 2,
  },
  productItem: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: Brand.surfaceAlt,
    borderRadius: RADIUS_SM,
    padding: Spacing.two,
    borderWidth: 1,
    borderColor: Brand.borderLight,
  },
  productItemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  productNoImage: { justifyContent: 'center', alignItems: 'center' },
  productItemInfo: { flex: 1, gap: 2 },
  productItemName: { fontSize: 13, fontWeight: '700', color: Brand.text, lineHeight: 16 },
  productItemStore: { fontSize: 11, color: Brand.textTertiary },
  productItemBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  productItemQty: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.textSecondary,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  productItemPrice: { fontSize: 13, fontWeight: '800', color: Brand.primary },

  // Cost breakdown
  costBreakdown: {
    backgroundColor: Brand.surfaceAlt,
    borderRadius: RADIUS_SM,
    padding: Spacing.two + 2,
    gap: 5,
  },
  costRow: { flexDirection: 'row', justifyContent: 'space-between' },
  costLabel: { fontSize: 13, color: Brand.textSecondary },
  costValue: { fontSize: 13, fontWeight: '600', color: Brand.text },

  // Total bar — full width green gradient feel
  totalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    backgroundColor: Brand.primary,
    borderRadius: RADIUS_SM,
  },
  totalBarLabel: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  totalBarValue: { fontSize: 17, fontWeight: '900', color: '#FFFFFF' },

  // ── Coupon ─────────────────────────────────────────────────
  couponRow: { flexDirection: 'row', gap: Spacing.one + 2, marginTop: Spacing.two },
  couponInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    backgroundColor: Brand.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Brand.borderLight,
    borderRadius: RADIUS_SM,
    paddingHorizontal: Spacing.two + 2,
  },
  couponInput: {
    flex: 1,
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
    fontSize: 14,
    color: Brand.text,
    fontWeight: '600',
  },
  couponBtn: {
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.three,
    borderRadius: RADIUS_SM,
    justifyContent: 'center',
    alignItems: 'center',
  },
  couponBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  couponMsgWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Spacing.one + 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
    backgroundColor: Brand.primary + '10',
    borderRadius: 8,
  },
  couponMsgError: { backgroundColor: Brand.danger + '10' },
  couponMsg: { fontSize: 12, fontWeight: '600', color: Brand.primary, flex: 1 },

  // ── Footer ─────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.three - 2,
    paddingVertical: Spacing.two,
    paddingBottom: Platform.select({ ios: Spacing.two + 4, android: Spacing.two }),
    borderTopWidth: 1,
    borderTopColor: Brand.borderLight,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },
  footerLeft: { gap: 1 },
  footerLabel: { fontSize: 11, color: Brand.textTertiary, fontWeight: '600' },
  footerTotalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  footerCurrency: { fontSize: 12, fontWeight: '700', color: Brand.primary },
  footerTotalValue: { fontSize: 20, fontWeight: '900', color: Brand.primary },
  placeOrderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one + 2,
    backgroundColor: Brand.primary,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
    borderRadius: RADIUS,
    elevation: 4,
    shadowColor: Brand.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  placeOrderBtnDisabled: { opacity: 0.5 },
  placeOrderBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  // ── Success overlay ────────────────────────────────────────
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
    borderRadius: 22,
    padding: Spacing.four,
    alignItems: 'center',
    marginHorizontal: Spacing.four,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  successIconWrap: { marginBottom: Spacing.three - 2 },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: { fontSize: 21, fontWeight: '900', color: Brand.text },
  successSub: { fontSize: 14, color: Brand.textSecondary, marginTop: Spacing.one, textAlign: 'center' },
  successBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    marginTop: Spacing.three + 2,
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.four,
    paddingVertical: 13,
    borderRadius: RADIUS,
    elevation: 4,
    shadowColor: Brand.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  successBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  successSecondary: { marginTop: Spacing.two },
  successSecondaryText: { color: Brand.textSecondary, fontWeight: '600', fontSize: 14 },
});
