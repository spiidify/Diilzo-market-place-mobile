import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useScreenshotPrevention } from '@/hooks/useScreenshotPrevention';
import {
  cancelSubscription,
  getSellerPlans,
  getSubscription,
  subscribeToPlan,
  type SellerPlan,
  type SubscriptionSummary,
} from '@/services/financial';

export default function SellerSubscriptionScreen() {
  const router = useRouter();
  useScreenshotPrevention(true);
  const [plans, setPlans] = useState<SellerPlan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SellerPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('mtn_momo');

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const [plansRes, subRes] = await Promise.all([
        getSellerPlans(),
        getSubscription().catch(() => null),
      ]);
      setPlans(plansRes.plans || []);
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

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    try {
      setSubscribing(true);
      const ref = `SUB-${Date.now()}`;
      await subscribeToPlan({
        plan_code: selectedPlan.code,
        billing_period: 'monthly',
        payment_method: paymentMethod,
        transaction_reference: ref,
      });
      setSelectedPlan(null);
      Alert.alert('Success', `Subscribed to ${selectedPlan.name}`);
      await load();
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
                You're on the Free plan. Upgrade to unlock more products, lower commissions, and premium features.
              </Text>
            </View>
          )}

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

                <View style={styles.planPriceRow}>
                  <Text style={styles.planPrice}>UGX {fmt(plan.monthly_price)}</Text>
                  <Text style={styles.planPeriod}>/month</Text>
                </View>
                <Text style={styles.planYearly}>UGX {fmt(plan.yearly_price)}/year</Text>

                <View style={styles.featuresList}>
                  <FeatureItem text={`${plan.product_limit || 'Unlimited'} products`} />
                  <FeatureItem text={`${plan.commission_discount}% commission discount`} />
                  {plan.features?.advanced_analytics ? <FeatureItem text="Advanced analytics" /> : null}
                  {plan.features?.priority_support ? <FeatureItem text="Priority support" /> : null}
                  {plan.features?.international_selling ? <FeatureItem text="International selling" /> : null}
                  {plan.features?.storefront_customization ? <FeatureItem text="Storefront customization" /> : null}
                  {plan.features?.b2b_tools ? <FeatureItem text="B2B tools" /> : null}
                  {plan.features?.api_access ? <FeatureItem text="API access" /> : null}
                  {plan.features?.custom_domain ? <FeatureItem text="Custom domain" /> : null}
                  {Number(plan.advertising_credit) > 0 ? <FeatureItem text={`UGX ${fmt(plan.advertising_credit)} ad credit`} /> : null}
                </View>

                <Pressable
                  style={[styles.subscribeBtn, isCurrent && { backgroundColor: Brand.border }, plan.is_featured && !isCurrent && { backgroundColor: Brand.primary }]}
                  disabled={isCurrent || subscribing}
                  onPress={() => setSelectedPlan(plan)}
                >
                  <Text style={styles.subscribeBtnText}>
                    {isCurrent ? 'Current Plan' : plan.is_free ? 'Switch to Free' : 'Subscribe'}
                  </Text>
                </Pressable>
              </View>
            );
          })}

          <Pressable style={styles.billingLink} onPress={() => router.push('/seller/billing')}>
            <MaterialCommunityIcons name="history" size={20} color={Brand.primary} />
            <Text style={styles.billingLinkText}>View Billing History</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Brand.textTertiary} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Subscribe modal */}
      <Modal visible={!!selectedPlan} transparent animationType="slide" onRequestClose={() => setSelectedPlan(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Subscribe to {selectedPlan?.name}</Text>
            <Text style={styles.modalPrice}>UGX {fmt(selectedPlan?.monthly_price)} / month</Text>

            <Text style={styles.modalLabel}>Payment Method</Text>
            <View style={styles.paymentMethods}>
              {[
                { code: 'mtn_momo', label: 'MTN MoMo' },
                { code: 'airtel_money', label: 'Airtel Money' },
                { code: 'card', label: 'Card' },
              ].map((m) => (
                <Pressable
                  key={m.code}
                  style={[styles.paymentMethod, paymentMethod === m.code && { borderColor: Brand.primary, backgroundColor: '#DCF5EC' }]}
                  onPress={() => setPaymentMethod(m.code)}
                >
                  <Text style={styles.paymentMethodText}>{m.label}</Text>
                </Pressable>
              ))}
            </View>

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

function FeatureItem({ text }: { text: string }) {
  return (
    <View style={styles.featureItem}>
      <MaterialCommunityIcons name="check" size={14} color={Brand.success} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  body: { padding: 12, paddingBottom: 32 },

  currentPlanBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#DCF5EC', borderRadius: 14, padding: 14, marginBottom: 12,
  },
  currentPlanInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  currentPlanTitle: { fontSize: 15, fontWeight: '700', color: Brand.text },
  currentPlanSub: { fontSize: 12, color: Brand.textSecondary, textTransform: 'capitalize' },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Brand.danger },
  cancelBtnText: { fontSize: 12, fontWeight: '700', color: Brand.danger },

  freeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#DCF5EC', borderRadius: 12, padding: 12, marginBottom: 12,
  },
  freeBannerText: { flex: 1, fontSize: 12, color: Brand.textSecondary },

  planCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Brand.border,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  planName: { fontSize: 18, fontWeight: '800', color: Brand.text, flex: 1 },
  popularBadge: { backgroundColor: Brand.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  popularText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  freeBadge: { backgroundColor: '#DCF5EC', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  freeText: { fontSize: 10, fontWeight: '700', color: Brand.success },

  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  planPrice: { fontSize: 24, fontWeight: '900', color: Brand.primary },
  planPeriod: { fontSize: 13, color: Brand.textSecondary, marginLeft: 4 },
  planYearly: { fontSize: 12, color: Brand.textTertiary, marginBottom: 14 },

  featuresList: { gap: 6, marginBottom: 16 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { fontSize: 13, color: Brand.text },

  subscribeBtn: {
    backgroundColor: Brand.dark, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  subscribeBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  billingLink: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginTop: 8,
  },
  billingLinkText: { flex: 1, fontSize: 14, fontWeight: '600', color: Brand.primary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text, marginBottom: 4 },
  modalPrice: { fontSize: 14, color: Brand.textSecondary, marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: Brand.text, marginBottom: 8 },
  paymentMethods: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  paymentMethod: { flex: 1, borderWidth: 1, borderColor: Brand.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  paymentMethodText: { fontSize: 13, fontWeight: '600', color: Brand.text },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: Brand.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: Brand.textSecondary },
  modalConfirmBtn: { flex: 1, backgroundColor: Brand.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
