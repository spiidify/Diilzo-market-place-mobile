import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { getSubscriptionPaymentStatus } from '@/services/financial';
import { getMembership, upgradeMembership, type MembershipInfo } from '@/services/seller';

interface TierInfo {
  key: string;
  name: string;
  price: string;
  icon: string;
  color: string;
  features: { label: string; included: boolean }[];
}

// Prices are filled from membership.tier_prices (regional); the `price`
// strings below are only fallbacks if the API omits a tier.
const TIERS: TierInfo[] = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    icon: 'account-outline',
    color: '#9CA3AF',
    features: [
      { label: '5 product listings', included: true },
      { label: 'Basic store page', included: true },
      { label: 'RFQ access', included: false },
      { label: 'Trade Assurance', included: false },
      { label: 'Priority search', included: false },
      { label: 'Analytics', included: false },
    ],
  },
  {
    key: 'verified',
    name: 'Verified',
    price: '$2,999',
    icon: 'check-circle-outline',
    color: Brand.primary,
    features: [
      { label: 'Unlimited products', included: true },
      { label: 'RFQ access', included: true },
      { label: 'Trade Assurance', included: true },
      { label: 'Priority search', included: false },
      { label: 'Featured placement', included: false },
      { label: 'Analytics access', included: true },
    ],
  },
  {
    key: 'gold',
    name: 'Gold',
    price: '$4,999',
    icon: 'crown',
    color: '#F59E0B',
    features: [
      { label: 'Unlimited products', included: true },
      { label: 'RFQ access', included: true },
      { label: 'Trade Assurance', included: true },
      { label: 'Priority search', included: true },
      { label: 'Featured placement', included: true },
      { label: 'Dedicated manager', included: true },
    ],
  },
];

const fmtPrice = (v: string | number | undefined | null) =>
  Number(v || 0).toLocaleString();

export default function SellerMembershipScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [membership, setMembership] = useState<MembershipInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<TierInfo | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('mtn_momo');
  const [payerPhone, setPayerPhone] = useState('');
  const [pendingPayment, setPendingPayment] = useState<{
    txId: number; tierName: string; amount: string; currency: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const data = await getMembership();
      setMembership(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load membership');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pollPayment = useCallback(async (txId: number, tierName: string) => {
    // Gateway settles asynchronously — poll until the backend confirms the
    // charge and activates the tier (max ~2 min).
    try {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 4000));
        try {
          const s = await getSubscriptionPaymentStatus(txId);
          if (s.status === 'completed') {
            setPendingPayment(null);
            await load();
            Alert.alert('Payment Confirmed', `${tierName} is now active.`);
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
    } catch { /* noop */ }
  }, [load]);

  const handleUpgrade = (tier: TierInfo) => {
    if (tier.key === 'free') {
      Alert.alert(
        'Switch to Free',
        'Downgrade to the free tier? It applies at the end of your current period where a paid membership exists.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Switch', style: 'destructive', onPress: () => runUpgrade(tier) },
        ],
      );
      return;
    }
    setSelectedTier(tier);
  };

  const runUpgrade = async (tier: TierInfo) => {
    const isMomo = ['mtn_momo', 'airtel_money'].includes(paymentMethod);
    if (tier.key !== 'free' && isMomo && payerPhone.trim().replace(/\D/g, '').length < 9) {
      Alert.alert('Phone Required', 'Enter the mobile money number to charge.');
      return;
    }
    setUpgrading(true);
    try {
      const res = await upgradeMembership({
        tier: tier.key,
        payment_method: paymentMethod,
        payer_phone: payerPhone.trim(),
      });
      setSelectedTier(null);
      if (res.status === 'completed') {
        await load();
        Alert.alert('Success', res.message || `${tier.name} is now active.`);
      } else if (res.status === 'failed') {
        Alert.alert('Payment Failed', res.failure_reason || res.message || 'The charge could not be initiated.');
      } else {
        if (res.redirect_url) {
          Linking.openURL(res.redirect_url).catch(() => {});
        }
        if (res.id) {
          setPendingPayment({
            txId: res.id, tierName: res.tier,
            amount: res.amount || '', currency: res.currency || '',
          });
          pollPayment(res.id, res.tier);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to process the request');
    } finally {
      setUpgrading(false);
    }
  };

  const currentTier = membership?.tier || 'free';

  return (
    <View style={styles.screen}>
      <ModernHeader title="Membership" showBack />

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : membership ? (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
          >
            {/* Current status banner */}
            <View style={[styles.currentBanner, { backgroundColor: (membership.tier === 'gold' ? '#F59E0B' : membership.tier === 'verified' ? Brand.primary : '#9CA3AF') + '15' }]}>
              <View style={[styles.currentIcon, { backgroundColor: (membership.tier === 'gold' ? '#F59E0B' : membership.tier === 'verified' ? Brand.primary : '#9CA3AF') + '25' }]}>
                <MaterialCommunityIcons
                  name={membership.tier === 'gold' ? 'crown' : membership.tier === 'verified' ? 'check-circle' : 'account'}
                  size={28}
                  color={membership.tier === 'gold' ? '#F59E0B' : membership.tier === 'verified' ? Brand.primary : '#9CA3AF'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.currentTier}>
                  {membership.tier === 'gold' ? 'Gold Supplier' : membership.tier === 'verified' ? 'Verified Supplier' : 'Free Supplier'}
                </Text>
                <Text style={styles.currentSub}>
                  {membership.is_active ? 'Active' : 'Inactive'}
                  {membership.days_remaining > 0 ? ` · ${membership.days_remaining} days remaining` : ''}
                </Text>
              </View>
            </View>

            {/* Pending payment — waiting for the charge to confirm */}
            {pendingPayment ? (
              <View style={styles.pendingBanner}>
                <ActivityIndicator size="small" color="#9A3412" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingTitle}>
                    Awaiting payment — {pendingPayment.tierName}
                  </Text>
                  <Text style={styles.pendingSub}>
                    {pendingPayment.currency} {fmtPrice(pendingPayment.amount)} · approve the prompt on your phone
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Regional pricing notice */}
            {membership.region_label ? (
              <View style={styles.regionNotice}>
                <MaterialCommunityIcons name="earth" size={16} color="#1D4ED8" />
                <Text style={styles.regionNoticeText}>Prices shown for your region: {membership.region_label}</Text>
              </View>
            ) : null}

            {/* Tier cards */}
            {TIERS.map((tier) => {
              const isCurrent = currentTier === tier.key;
              const isUpgrade = ['free', 'verified', 'gold'].indexOf(tier.key) > ['free', 'verified', 'gold'].indexOf(currentTier);
              const apiPrice = membership.tier_prices?.[tier.key];
              const priceText = apiPrice
                ? `${apiPrice.currency} ${fmtPrice(apiPrice.yearly)}`
                : tier.price;
              return (
                <View
                  key={tier.key}
                  style={[styles.tierCard, isCurrent && { borderColor: tier.color, borderWidth: 2 }]}
                >
                  <View style={styles.tierHeader}>
                    <View style={[styles.tierIcon, { backgroundColor: tier.color + '20' }]}>
                      <MaterialCommunityIcons name={tier.icon as any} size={28} color={tier.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tierName}>{apiPrice?.name || tier.name}</Text>
                      <Text style={styles.tierPrice}>{priceText}<Text style={styles.tierPriceSub}>/year</Text></Text>
                    </View>
                    {isCurrent && (
                      <View style={[styles.currentBadge, { backgroundColor: tier.color }]}>
                        <Text style={styles.currentBadgeText}>Current</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.featureList}>
                    {tier.features.map((feat, fi) => (
                      <View key={fi} style={styles.featureRow}>
                        <MaterialCommunityIcons
                          name={feat.included ? 'check-circle' : 'close-circle-outline'}
                          size={18}
                          color={feat.included ? Brand.primary : colors.textTertiary}
                        />
                        <Text style={[styles.featureText, !feat.included && { color: colors.textTertiary }]}>
                          {feat.label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {!isCurrent && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.tierBtn,
                        { backgroundColor: isUpgrade ? tier.color : c_border(colors) },
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={() => handleUpgrade(tier)}
                      disabled={upgrading}
                    >
                      {upgrading && selectedTier?.key === tier.key ? (
                        <ActivityIndicator size="small" color={isUpgrade ? '#FFFFFF' : colors.text} />
                      ) : (
                        <Text style={[styles.tierBtnText, { color: isUpgrade ? '#FFFFFF' : colors.text }]}>
                          {tier.key === 'free' ? 'Switch to Free' : isUpgrade ? `Pay & Upgrade to ${tier.name}` : `Pay & Switch to ${tier.name}`}
                        </Text>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })}

            <View style={{ height: 30 }} />
          </ScrollView>
        ) : null}
      </View>

      {/* Payment modal */}
      <Modal visible={!!selectedTier} transparent animationType="slide" onRequestClose={() => setSelectedTier(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedTier?.name} Membership</Text>
            <Text style={styles.modalPrice}>
              {(() => {
                const apiPrice = membership?.tier_prices?.[selectedTier?.key || ''];
                return apiPrice
                  ? `${apiPrice.currency} ${fmtPrice(apiPrice.yearly)} / year`
                  : `${selectedTier?.price || ''} / year`;
              })()}
            </Text>

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

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setSelectedTier(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirmBtn}
                onPress={() => selectedTier && runUpgrade(selectedTier)}
                disabled={upgrading}
              >
                <Text style={styles.modalConfirmText}>{upgrading ? 'Processing…' : 'Pay & Activate'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function c_border(c: ThemeColors) { return c.borderLight; }

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  body: { flex: 1 },
  bodyContent: { padding: 14, paddingBottom: 20 },

  // Current banner
  currentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 8, borderRadius: 14, marginBottom: 16,
  },
  currentIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  currentTier: { fontSize: 18, fontWeight: '800', color: c.text },
  currentSub: { fontSize: 13, color: c.textSecondary, marginTop: 2 },

  regionNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, marginBottom: 14,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  regionNoticeText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#1D4ED8' },

  // Tier card
  tierCard: {
    backgroundColor: c.surface, borderRadius: 16, padding: 20,
    marginBottom: 14, borderWidth: 1, borderColor: c.borderLight,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  tierIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  tierName: { fontSize: 18, fontWeight: '800', color: c.text },
  tierPrice: { fontSize: 24, fontWeight: '900', color: c.text, marginTop: 2 },
  tierPriceSub: { fontSize: 14, color: c.textTertiary, fontWeight: '500' },
  currentBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  currentBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },

  // Features
  featureList: { gap: 10, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 14, color: c.text, fontWeight: '500' },

  // Button
  tierBtn: {
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
  },
  tierBtnText: { fontSize: 15, fontWeight: '800' },

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF7ED', borderRadius: 12, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  pendingTitle: { fontSize: 13, fontWeight: '700', color: '#9A3412' },
  pendingSub: { fontSize: 11.5, color: '#9A3412', marginTop: 2 },

  // Payment modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: c.text, textAlign: 'center' },
  modalPrice: { fontSize: 15, fontWeight: '600', color: c.textSecondary, textAlign: 'center', marginTop: 6 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: c.textSecondary, marginTop: 18, marginBottom: 8, textTransform: 'uppercase' },
  paymentMethods: { flexDirection: 'row', gap: 8 },
  paymentMethod: {
    flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1,
    borderColor: c.borderLight, alignItems: 'center',
  },
  paymentMethodText: { fontSize: 13, fontWeight: '700', color: c.text },
  phoneInput: {
    borderWidth: 1, borderColor: c.borderLight, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: c.text, backgroundColor: c.surface,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: c.borderLight,
  },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: c.textSecondary },
  modalConfirmBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: Brand.primary,
  },
  modalConfirmText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
