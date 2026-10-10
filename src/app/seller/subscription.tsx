import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { useScreenshotPrevention } from '@/hooks/useScreenshotPrevention';
import {
  cancelSubscription,
  getSellerPlans,
  getSubscription,
  getSubscriptionPaymentStatus,
  subscribeToPlan,
  type SellerPlan,
  type SubscriptionSummary
} from '@/services/financial';

export default function SellerSubscriptionScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  useScreenshotPrevention(true);
  const [plans, setPlans] = useState<SellerPlan[]>([]);
  const [regionLabel, setRegionLabel] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SellerPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('mtn_momo');
  const [payerPhone, setPayerPhone] = useState('');
  const [pendingPayment, setPendingPayment] = useState<{
    txId: number; planName: string; amount: string; currency: string;
  } | null>(null);
  const [polling, setPolling] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const [plansRes, subRes] = await Promise.all([
        getSellerPlans(),
        getSubscription().catch(() => null),
      ]);
      setPlans(plansRes.plans || []);
      setRegionLabel(plansRes.region_label || null);
      setSubscription(subRes);
    } catch (e: any) {
      setError(e?.message || 'Failed to load subscription data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (v: string | number | undefined | null) => Number(v || 0).toLocaleString();

  const pollPayment = useCallback(async (txId: number, planName: string) => {
    // MoMo/hosted gateways settle asynchronously — poll until the backend
    // confirms the charge and activates the plan (max ~2 min).
    setPolling(true);
    try {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 4000));
        try {
          const s = await getSubscriptionPaymentStatus(txId);
          if (s.status === 'completed') {
            setPendingPayment(null);
            await load();
            Alert.alert('Payment Confirmed', `${planName} is now active.`);
            return;
          }
          if (s.status === 'failed') {
            setPendingPayment(null);
            Alert.alert('Payment Failed', s.failure_reason || 'The charge was declined. Try again.');
            return;
          }
        } catch { /* keep polling on transient errors */ }
      }
      setPendingPayment(null);
      Alert.alert('Still Processing', 'Payment is taking longer than expected — pull to refresh to check again.');
    } finally {
      setPolling(false);
    }
  }, [load]);

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    const isMomo = ['mtn_momo', 'airtel_money'].includes(paymentMethod);
    const isB2B = selectedPlan.plan_type === 'b2b';
    const needsPhone = isMomo && !selectedPlan.is_free;
    if (needsPhone && payerPhone.trim().replace(/\D/g, '').length < 9) {
      Alert.alert('Phone Required', 'Enter the mobile money number to charge.');
      return;
    }
    try {
      setSubscribing(true);
      const res = await subscribeToPlan({
        plan_code: selectedPlan.code,
        billing_period: isB2B ? 'yearly' : 'monthly',
        payment_method: paymentMethod,
        payer_phone: payerPhone.trim(),
        transaction_reference: `SUB-${Date.now()}`,
      });
      setSelectedPlan(null);

      if (res.status === 'completed') {
        await load();
        Alert.alert('Success', `${selectedPlan.name} is now active.`);
      } else if (res.status === 'failed') {
        Alert.alert('Payment Failed', res.failure_reason || 'The charge could not be initiated.');
      } else {
        // Pending — hosted checkout (PayPal/card) gets a redirect URL;
        // mobile money just needs the phone prompt approved.
        if (res.redirect_url) {
          Linking.openURL(res.redirect_url).catch(() => {});
        }
        setPendingPayment({
          txId: res.id, planName: selectedPlan.name,
          amount: res.amount, currency: res.currency,
        });
        pollPayment(res.id, selectedPlan.name);
      }
    } catch (e: any) {
      Alert.alert('Subscription Failed', e?.message || 'Please try again');
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Subscription',
      'You will lose plan benefits at the end of the billing period.',
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelSubscription();
              Alert.alert('Cancelled', 'Your subscription has been cancelled.');
              await load();
            } catch (e: any) {
              Alert.alert('Failed', e?.message || 'Try again later');
            }
          },
        },
      ]
    );
  };

  if (loading && plans.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Subscription Plans" subtitle="Choose your plan" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (error && plans.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Subscription Plans" subtitle="Choose your plan" />
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const currentPlanCode = subscription?.current_plan?.code;

  return (
    <View style={styles.screen}>
      <ModernHeader title="Subscription Plans" subtitle="Choose your plan" />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
      >
        <View style={styles.body}>
          {/* Pending payment — waiting for the charge to confirm */}
          {pendingPayment ? (
            <View style={styles.pendingBanner}>
              <ActivityIndicator size="small" color={Brand.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingTitle}>
                  Awaiting payment — {pendingPayment.planName}
                </Text>
                <Text style={styles.pendingSub}>
                  {pendingPayment.currency} {fmt(pendingPayment.amount)} · approve the prompt on your phone{polling ? '' : ' — checking…'}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Current plan banner */}
          {subscription?.current_plan ? (
            <View style={styles.currentPlanBanner}>
              <View style={styles.currentPlanInfo}>
                <MaterialCommunityIcons name="check-circle" size={22} color={Brand.success} />
                <View>
                  <Text style={styles.currentPlanTitle}>{subscription.current_plan.name}</Text>
                  <Text style={styles.currentPlanSub}>
                    {subscription.status} · {subscription.days_remaining > 0 ? `${subscription.days_remaining} days left` : 'Expired'}
                  </Text>
                </View>
              </View>
              <Pressable onPress={handleCancel} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.freeBanner}>
              <MaterialCommunityIcons name="information-outline" size={20} color={Brand.primary} />
              <Text style={styles.freeBannerText}>
                You're on the Free plan. Upgrade to unlock POS, inventory tools, more products, and lower commissions.
              </Text>
            </View>
          )}

          {/* Fees & access — what the store pays and unlocks */}
          <View style={styles.feeCard}>
            <Text style={styles.feeCardTitle}>Your Store's Fees & Access</Text>
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Marketplace commission</Text>
              <Text style={styles.feeValue}>
                {subscription?.effective_commission ?? '—'}%
                {subscription?.plan_discount && Number(subscription.plan_discount) > 0
                  ? ` (−${subscription.plan_discount}% plan)` : ''}
              </Text>
            </View>
            {(subscription?.seller_fees?.length ?? 0) > 0 && (
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Seller fees</Text>
                <Text style={styles.feeValue}>
                  {subscription!.seller_fees!.map((f) => `${f.name} ${f.percentage}%`).join(', ')}
                </Text>
              </View>
            )}
            {(subscription?.buyer_fees?.length ?? 0) > 0 && (
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Buyer fees</Text>
                <Text style={styles.feeValue}>
                  {subscription!.buyer_fees!.map((f) => `${f.name} ${f.percentage}%`).join(', ')}
                </Text>
              </View>
            )}
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>POS & Inventory</Text>
              <Text style={[styles.feeValue, subscription?.tools_access ? styles.feeOk : styles.feeWarn]}>
                {subscription?.tools_access ? 'Included' : 'Paid plans only'}
              </Text>
            </View>
          </View>

          {/* Regional pricing notice */}
          {regionLabel ? (
            <View style={styles.regionNotice}>
              <MaterialCommunityIcons name="earth" size={16} color={Brand.primary} />
              <Text style={styles.regionNoticeText}>Prices shown for your region: {regionLabel}</Text>
            </View>
          ) : null}

          {/* Plans grid */}
          {plans.map((plan) => {
            const isCurrent = plan.code === currentPlanCode;
            return (
              <View
                key={plan.id}
                style={[styles.planCard, plan.is_featured && { borderColor: Brand.primary, borderWidth: 2 }]}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {plan.is_featured ? (
                    <View style={styles.popularBadge}><Text style={styles.popularText}>POPULAR</Text></View>
                  ) : null}
                  {plan.is_free ? (
                    <View style={styles.freeBadge}><Text style={styles.freeText}>FREE</Text></View>
                  ) : null}
                </View>

                {plan.plan_type === 'b2b' ? (
                  <View style={styles.planPriceRow}>
                    <Text style={styles.planPrice}>{plan.currency} {fmt(plan.yearly_price)}</Text>
                    <Text style={styles.planPeriod}>/year</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.planPriceRow}>
                      <Text style={styles.planPrice}>{plan.currency} {fmt(plan.monthly_price)}</Text>
                      <Text style={styles.planPeriod}>/month</Text>
                    </View>
                    <Text style={styles.planYearly}>{plan.currency} {fmt(plan.yearly_price)}/year</Text>
                  </>
                )}

                <View style={styles.featuresList}>
                  <FeatureItem text={`${plan.product_limit || 'Unlimited'} products`} styles={styles} />
                  <FeatureItem
                    text={plan.selling_tools ? 'POS & inventory tools' : 'POS & inventory — paid plans'}
                    locked={!plan.selling_tools}
                    styles={styles}
                  />
                  <FeatureItem text={`${plan.commission_discount}% commission discount`} styles={styles} />
                  {plan.features?.advanced_analytics ? <FeatureItem text="Advanced analytics" styles={styles} /> : null}
                  {plan.features?.priority_support ? <FeatureItem text="Priority support" styles={styles} /> : null}
                  {plan.features?.international_selling ? <FeatureItem text="International selling" styles={styles} /> : null}
                  {plan.features?.storefront_customization ? <FeatureItem text="Storefront customization" styles={styles} /> : null}
                  {plan.features?.b2b_tools ? <FeatureItem text="B2B tools" styles={styles} /> : null}
                  {plan.features?.api_access ? <FeatureItem text="API access" styles={styles} /> : null}
                  {plan.features?.custom_domain ? <FeatureItem text="Custom domain" styles={styles} /> : null}
                  {Number(plan.advertising_credit) > 0 ? <FeatureItem text={`${plan.currency} ${fmt(plan.advertising_credit)} ad credit`} styles={styles} /> : null}
                </View>

                <Pressable
                  style={[styles.subscribeBtn, isCurrent && { backgroundColor: colors.border }, plan.is_featured && !isCurrent && { backgroundColor: Brand.primary }]}
                  disabled={isCurrent || subscribing}
                  onPress={() => setSelectedPlan(plan)}
                >
                  <Text style={styles.subscribeBtnText}>
                    {isCurrent ? 'Current Plan' : plan.is_free ? 'Switch to Free' : 'Pay & Activate'}
                  </Text>
                </Pressable>
              </View>
            );
          })}

          <Pressable style={styles.billingLink} onPress={() => router.push('/seller/billing')}>
            <MaterialCommunityIcons name="history" size={20} color={Brand.primary} />
            <Text style={styles.billingLinkText}>View Billing History</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Subscribe modal */}
      <Modal visible={!!selectedPlan} transparent animationType="slide" onRequestClose={() => setSelectedPlan(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Subscribe to {selectedPlan?.name}</Text>
            {selectedPlan?.is_free ? (
              <Text style={styles.modalPrice}>Free</Text>
            ) : selectedPlan?.plan_type === 'b2b' ? (
              <Text style={styles.modalPrice}>{selectedPlan?.currency} {fmt(selectedPlan?.yearly_price)} / year</Text>
            ) : (
              <Text style={styles.modalPrice}>{selectedPlan?.currency} {fmt(selectedPlan?.monthly_price)} / month</Text>
            )}

            {!selectedPlan?.is_free ? (
              <>
                <Text style={styles.modalLabel}>Payment Method</Text>
            <View style={styles.paymentMethods}>
              {[
                { code: 'mtn_momo', label: 'MTN MoMo' },
                { code: 'airtel_money', label: 'Airtel Money' },
                { code: 'paypal', label: 'PayPal' },
              ].map((m) => (
                <Pressable
                  key={m.code}
                  style={[styles.paymentMethod, paymentMethod === m.code && { borderColor: Brand.primary, backgroundColor: '#EDE9FE' }]}
                  onPress={() => setPaymentMethod(m.code)}
                >
                  <Text style={styles.paymentMethodText}>{m.label}</Text>
                </Pressable>
              ))}
            </View>

            {['mtn_momo', 'airtel_money'].includes(paymentMethod) ? (
              <>
                <Text style={styles.modalLabel}>Mobile Money Number</Text>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="e.g. 2567XXXXXXXX"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                  value={payerPhone}
                  onChangeText={setPayerPhone}
                />
              </>
            ) : null}
              </>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setSelectedPlan(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={handleSubscribe} disabled={subscribing}>
                <Text style={styles.modalConfirmText}>{subscribing ? 'Processing...' : 'Confirm'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FeatureItem({ text, locked, styles }: { text: string; locked?: boolean; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.featureItem}>
      <MaterialCommunityIcons name={locked ? 'lock-outline' : 'check'} size={14} color={locked ? '#94A3B8' : Brand.success} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  feeCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 8, marginBottom: 14,
    borderWidth: 1, borderColor: c.border,
  },
  feeCardTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 10 },
  feeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 12, paddingVertical: 5,
  },
  feeLabel: { fontSize: 12.5, color: c.textSecondary, flexShrink: 0 },
  feeValue: { fontSize: 12.5, fontWeight: '600', color: c.text, flex: 1, textAlign: 'right' },
  feeOk: { color: Brand.success },
  feeWarn: { color: '#B45309' },

  body: { padding: 12, paddingBottom: 32 },

  currentPlanBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EDE9FE', borderRadius: 14, padding: 14, marginBottom: 12,
  },
  currentPlanInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  currentPlanTitle: { fontSize: 15, fontWeight: '700', color: c.text },
  currentPlanSub: { fontSize: 12, color: c.textSecondary, textTransform: 'capitalize' },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Brand.danger },
  cancelBtnText: { fontSize: 12, fontWeight: '700', color: Brand.danger },

  freeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EDE9FE', borderRadius: 12, padding: 12, marginBottom: 12,
  },
  freeBannerText: { flex: 1, fontSize: 12, color: c.textSecondary },

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF7ED', borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  pendingTitle: { fontSize: 13, fontWeight: '700', color: '#9A3412' },
  pendingSub: { fontSize: 11.5, color: '#9A3412', marginTop: 2 },

  phoneInput: {
    borderWidth: 1, borderColor: c.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: c.text, backgroundColor: c.surface, marginBottom: 4,
  },

  regionNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, marginBottom: 12,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  regionNoticeText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#1D4ED8' },

  planCard: {
    backgroundColor: c.surface, borderRadius: 16, padding: 8, marginBottom: 12, borderWidth: 1, borderColor: c.border,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  planName: { fontSize: 18, fontWeight: '800', color: c.text, flex: 1 },
  popularBadge: { backgroundColor: Brand.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  popularText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  freeBadge: { backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  freeText: { fontSize: 10, fontWeight: '700', color: Brand.success },

  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  planPrice: { fontSize: 24, fontWeight: '900', color: Brand.primary },
  planPeriod: { fontSize: 13, color: c.textSecondary, marginLeft: 4 },
  planYearly: { fontSize: 12, color: c.textTertiary, marginBottom: 14 },

  featuresList: { gap: 6, marginBottom: 16 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { fontSize: 13, color: c.text },

  subscribeBtn: {
    backgroundColor: Brand.dark, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  subscribeBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  billingLink: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.surface, borderRadius: 12, padding: 14, marginTop: 8,
  },
  billingLinkText: { flex: 1, fontSize: 14, fontWeight: '600', color: Brand.primary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: c.text, marginBottom: 4 },
  modalPrice: { fontSize: 14, color: c.textSecondary, marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 8 },
  paymentMethods: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  paymentMethod: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  paymentMethodText: { fontSize: 13, fontWeight: '600', color: c.text },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
  modalConfirmBtn: { flex: 1, backgroundColor: Brand.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
