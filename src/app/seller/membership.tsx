import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { getMembership, upgradeMembership, type MembershipInfo } from '@/services/seller';

interface TierInfo {
  key: string;
  name: string;
  price: string;
  icon: string;
  color: string;
  features: { label: string; included: boolean }[];
}

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

export default function SellerMembershipScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [membership, setMembership] = useState<MembershipInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleUpgrade = (tier: string) => {
    Alert.alert(
      'Confirm Upgrade',
      `Upgrade to ${tier.charAt(0).toUpperCase() + tier.slice(1)} tier? This will change your annual membership.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upgrade',
          onPress: async () => {
            setUpgrading(tier);
            try {
              await upgradeMembership(tier);
              Alert.alert('Success', `Upgraded to ${tier} tier!`);
              load();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || 'Failed to upgrade');
            } finally {
              setUpgrading(null);
            }
          },
        },
      ],
    );
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

            {/* Tier cards */}
            {TIERS.map((tier) => {
              const isCurrent = currentTier === tier.key;
              const isUpgrade = ['free', 'verified', 'gold'].indexOf(tier.key) > ['free', 'verified', 'gold'].indexOf(currentTier);
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
                      <Text style={styles.tierName}>{tier.name}</Text>
                      <Text style={styles.tierPrice}>{tier.price}<Text style={styles.tierPriceSub}>/year</Text></Text>
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
                      onPress={() => handleUpgrade(tier.key)}
                      disabled={upgrading === tier.key}
                    >
                      {upgrading === tier.key ? (
                        <ActivityIndicator size="small" color={isUpgrade ? '#FFFFFF' : colors.text} />
                      ) : (
                        <Text style={[styles.tierBtnText, { color: isUpgrade ? '#FFFFFF' : colors.text }]}>
                          {isUpgrade ? `Upgrade to ${tier.name}` : `Downgrade to ${tier.name}`}
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
    padding: 16, borderRadius: 14, marginBottom: 16,
  },
  currentIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  currentTier: { fontSize: 18, fontWeight: '800', color: c.text },
  currentSub: { fontSize: 13, color: c.textSecondary, marginTop: 2 },

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
});
