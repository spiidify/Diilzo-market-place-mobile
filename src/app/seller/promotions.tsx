import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import {
  activatePromotion,
  fetchMyPromotions,
  fetchPromotionAnalytics,
  fetchPromotionPackages,
  pausePromotion,
  purchasePromotion,
  resumePromotion,
} from '@/services/promotions';
import type { PromotionAnalytics, PromotionPackage, ProductPromotion } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  pending: Brand.rating,
  active: Brand.success,
  paused: '#8B5CF6',
  expired: Brand.textTertiary,
  cancelled: Brand.danger,
};

const PACKAGE_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  top_ad: 'pin',
  sponsored: 'bullhorn-outline',
  homepage_featured: 'star-circle-outline',
  category_pinned: 'bookmark',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SellerPromotionsScreen() {
  const router = useRouter();

  const [promotions, setPromotions] = useState<ProductPromotion[]>([]);
  const [packages, setPackages] = useState<PromotionPackage[]>([]);
  const [analytics, setAnalytics] = useState<PromotionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Purchase modal state
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PromotionPackage | null>(null);
  const [productId, setProductId] = useState('');
  const [targetKeywords, setTargetKeywords] = useState('');
  const [bidPerClick, setBidPerClick] = useState('');
  const [adBudget, setAdBudget] = useState('');
  const [purchasing, setPurchasing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const [promoData, pkgData, analyticsData] = await Promise.all([
        fetchMyPromotions(),
        fetchPromotionPackages(),
        fetchPromotionAnalytics().catch(() => null),
      ]);
      setPromotions(promoData);
      setPackages(pkgData);
      if (analyticsData) setAnalytics(analyticsData);
    } catch (e: any) {
      setError(e?.message || 'Failed to load promotions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePurchase = async () => {
    if (!selectedPackage) {
      Alert.alert('Select Package', 'Choose a promotion package first.');
      return;
    }
    if (!productId.trim()) {
      Alert.alert('Product ID Required', 'Enter the product ID to promote.');
      return;
    }
    setPurchasing(true);
    try {
      const promo = await purchasePromotion({
        product_id: parseInt(productId.trim(), 10),
        package_id: selectedPackage.id,
        target_keywords: targetKeywords.trim(),
        bid_per_click: bidPerClick ? parseFloat(bidPerClick) : undefined,
        ad_spend_budget: adBudget ? parseFloat(adBudget) : undefined,
      });
      Alert.alert(
        'Promotion Created',
        `Your ${selectedPackage.name} promotion is pending. Activate it after payment.`,
        [{ text: 'OK', onPress: () => { setShowPurchaseModal(false); load(); } }],
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to purchase promotion');
    } finally {
      setPurchasing(false);
    }
  };

  const handleActivate = async (promo: ProductPromotion) => {
    try {
      await activatePromotion(promo.id);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to activate');
    }
  };

  const handlePause = async (promo: ProductPromotion) => {
    try {
      await pausePromotion(promo.id);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to pause');
    }
  };

  const handleResume = async (promo: ProductPromotion) => {
    try {
      await resumePromotion(promo.id);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to resume');
    }
  };

  const renderPromotion = ({ item }: { item: ProductPromotion }) => {
    const statusColor = STATUS_COLORS[item.status] || Brand.textTertiary;
    const iconName = item.package_type ? PACKAGE_ICONS[item.package_type] : 'bullhorn-outline';

    return (
      <View style={styles.promoCard}>
        <View style={styles.promoHeader}>
          <View style={[styles.promoIcon, { backgroundColor: statusColor + '20' }]}>
            <MaterialCommunityIcons name={iconName} size={22} color={statusColor} />
          </View>
          <View style={styles.promoInfo}>
            <Text style={styles.promoProduct} numberOfLines={1}>{item.product_name}</Text>
            <Text style={styles.promoPackage}>{item.package_name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.impressions.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Impr</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.clicks.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Clicks</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.ctr}%</Text>
            <Text style={styles.statLabel}>CTR</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.conversion_rate}%</Text>
            <Text style={styles.statLabel}>Conv</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>UGX {Number(item.ad_spend).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Spent</Text>
          </View>
        </View>

        {/* Date range */}
        <Text style={styles.dateRange}>
          {formatDate(item.starts_at)} → {formatDate(item.ends_at)}
        </Text>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {item.status === 'pending' && (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: Brand.success }]}
              onPress={() => handleActivate(item)}
            >
              <MaterialCommunityIcons name="play" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Activate</Text>
            </Pressable>
          )}
          {item.status === 'active' && (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}
              onPress={() => handlePause(item)}
            >
              <MaterialCommunityIcons name="pause" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Pause</Text>
            </Pressable>
          )}
          {item.status === 'paused' && (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: Brand.primary }]}
              onPress={() => handleResume(item)}
            >
              <MaterialCommunityIcons name="play" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Resume</Text>
            </Pressable>
          )}
          {item.target_keywords && (
            <View style={styles.keywordsWrap}>
              {item.target_keywords.split(',').slice(0, 3).map((kw, i) => (
                <View key={i} style={styles.keywordChip}>
                  <Text style={styles.keywordText}>{kw.trim()}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

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
          <Text style={styles.headerTitle}>Promotions</Text>
          <Pressable onPress={() => setShowPurchaseModal(true)} hitSlop={12}>
            <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>
      </SafeAreaView>

      {loading ? (
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
          <Text style={styles.loadingText}>Loading promotions...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={load}
              colors={[Brand.primary]}
              tintColor={Brand.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Analytics summary */}
          {analytics && (
            <View style={styles.analyticsCard}>
              <Text style={styles.sectionTitle}>Performance Summary</Text>
              <View style={styles.analyticsGrid}>
                <View style={styles.analyticsItem}>
                  <Text style={styles.analyticsValue}>{analytics.total_promotions}</Text>
                  <Text style={styles.analyticsLabel}>Total</Text>
                </View>
                <View style={styles.analyticsItem}>
                  <Text style={[styles.analyticsValue, { color: Brand.success }]}>{analytics.active_promotions}</Text>
                  <Text style={styles.analyticsLabel}>Active</Text>
                </View>
                <View style={styles.analyticsItem}>
                  <Text style={styles.analyticsValue}>{analytics.total_impressions.toLocaleString()}</Text>
                  <Text style={styles.analyticsLabel}>Impr</Text>
                </View>
                <View style={styles.analyticsItem}>
                  <Text style={styles.analyticsValue}>{analytics.total_clicks.toLocaleString()}</Text>
                  <Text style={styles.analyticsLabel}>Clicks</Text>
                </View>
                <View style={styles.analyticsItem}>
                  <Text style={styles.analyticsValue}>{analytics.overall_ctr}%</Text>
                  <Text style={styles.analyticsLabel}>CTR</Text>
                </View>
                <View style={styles.analyticsItem}>
                  <Text style={styles.analyticsValue}>UGX {Math.round(analytics.total_ad_spend).toLocaleString()}</Text>
                  <Text style={styles.analyticsLabel}>Spent</Text>
                </View>
              </View>
            </View>
          )}

          {/* Available packages */}
          <Text style={styles.sectionTitle}>Boost Your Products</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.packagesScroll}>
            {packages.map((pkg) => {
              const icon = PACKAGE_ICONS[pkg.package_type] || 'bullhorn-outline';
              return (
                <Pressable
                  key={pkg.id}
                  style={styles.packageCard}
                  onPress={() => {
                    setSelectedPackage(pkg);
                    setShowPurchaseModal(true);
                  }}
                >
                  <View style={styles.packageIcon}>
                    <MaterialCommunityIcons name={icon} size={28} color={Brand.primary} />
                  </View>
                  <Text style={styles.packageName}>{pkg.name}</Text>
                  <Text style={styles.packageDuration}>{pkg.duration_days} days</Text>
                  <Text style={styles.packagePrice}>UGX {Number(pkg.price).toLocaleString()}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Active promotions */}
          <Text style={styles.sectionTitle}>My Promotions ({promotions.length})</Text>
          {promotions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="bullhorn-outline" size={48} color={Brand.textTertiary} />
              <Text style={styles.emptyTitle}>No Promotions Yet</Text>
              <Text style={styles.emptySubtitle}>
                Boost your products to appear at the top of search results and category pages
              </Text>
            </View>
          ) : (
            promotions.map((promo) => (
              <View key={promo.id}>{renderPromotion({ item: promo })}</View>
            ))
          )}
        </ScrollView>
      )}

      {/* Purchase Modal */}
      <Modal visible={showPurchaseModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedPackage ? selectedPackage.name : 'Select Package'}
              </Text>
              <Pressable onPress={() => setShowPurchaseModal(false)} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={24} color={Brand.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Package selection */}
              {!selectedPackage && (
                <View style={styles.packageList}>
                  {packages.map((pkg) => (
                    <Pressable
                      key={pkg.id}
                      style={styles.packageListItem}
                      onPress={() => setSelectedPackage(pkg)}
                    >
                      <MaterialCommunityIcons
                        name={PACKAGE_ICONS[pkg.package_type] || 'bullhorn-outline'}
                        size={24}
                        color={Brand.primary}
                      />
                      <View style={styles.packageListInfo}>
                        <Text style={styles.packageListName}>{pkg.name}</Text>
                        <Text style={styles.packageListDesc}>{pkg.duration_days} days</Text>
                      </View>
                      <Text style={styles.packageListPrice}>UGX {Number(pkg.price).toLocaleString()}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {selectedPackage && (
                <View style={styles.formContainer}>
                  <Text style={styles.formLabel}>Product ID</Text>
                  <TextInput
                    style={styles.formInput}
                    value={productId}
                    onChangeText={setProductId}
                    placeholder="Enter product ID"
                    keyboardType="numeric"
                    placeholderTextColor={Brand.textTertiary}
                  />

                  {selectedPackage.package_type === 'sponsored' && (
                    <>
                      <Text style={styles.formLabel}>Target Keywords (comma-separated)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={targetKeywords}
                        onChangeText={setTargetKeywords}
                        placeholder="e.g. phone, electronics, gadget"
                        placeholderTextColor={Brand.textTertiary}
                      />

                      <Text style={styles.formLabel}>Bid Per Click (UGX)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={bidPerClick}
                        onChangeText={setBidPerClick}
                        placeholder="50"
                        keyboardType="numeric"
                        placeholderTextColor={Brand.textTertiary}
                      />

                      <Text style={styles.formLabel}>Ad Spend Budget (UGX, 0 = unlimited)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={adBudget}
                        onChangeText={setAdBudget}
                        placeholder="50000"
                        keyboardType="numeric"
                        placeholderTextColor={Brand.textTertiary}
                      />
                    </>
                  )}

                  <Pressable
                    style={[styles.purchaseBtn, purchasing && { opacity: 0.6 }]}
                    onPress={handlePurchase}
                    disabled={purchasing}
                  >
                    {purchasing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="rocket-launch" size={20} color="#FFFFFF" />
                        <Text style={styles.purchaseBtnText}>
                          Purchase — UGX {Number(selectedPackage.price).toLocaleString()}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAF9' },
  safeArea: { backgroundColor: Brand.primaryDark },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },
  centerBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { marginTop: 12, color: Brand.textSecondary, fontSize: 14 },
  errorText: { marginTop: 12, color: Brand.danger, fontSize: 14, textAlign: 'center' },
  retryBtn: {
    marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 24,
    paddingVertical: 10, borderRadius: 8,
  },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Brand.text, marginBottom: 12, marginTop: 8 },

  // Analytics
  analyticsCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: Brand.borderLight,
  },
  analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  analyticsItem: { width: '31%', alignItems: 'center', paddingVertical: 8 },
  analyticsValue: { fontSize: 16, fontWeight: '700', color: Brand.text },
  analyticsLabel: { fontSize: 11, color: Brand.textTertiary, marginTop: 2 },

  // Packages
  packagesScroll: { marginBottom: 20 },
  packageCard: {
    width: 140, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
    marginRight: 12, alignItems: 'center', borderWidth: 1, borderColor: Brand.borderLight,
  },
  packageIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Brand.primary + '15',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  packageName: { fontSize: 14, fontWeight: '700', color: Brand.text, textAlign: 'center' },
  packageDuration: { fontSize: 12, color: Brand.textTertiary, marginTop: 2 },
  packagePrice: { fontSize: 15, fontWeight: '700', color: Brand.primary, marginTop: 6 },

  // Promotion cards
  promoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: Brand.borderLight,
  },
  promoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  promoIcon: {
    width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  promoInfo: { flex: 1 },
  promoProduct: { fontSize: 15, fontWeight: '700', color: Brand.text },
  promoPackage: { fontSize: 12, color: Brand.textTertiary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 13, fontWeight: '700', color: Brand.text },
  statLabel: { fontSize: 10, color: Brand.textTertiary, marginTop: 2 },

  dateRange: { fontSize: 12, color: Brand.textSecondary, marginBottom: 10 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  keywordsWrap: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  keywordChip: { backgroundColor: Brand.surfaceAlt, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  keywordText: { fontSize: 11, color: Brand.textSecondary },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Brand.text, marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: Brand.textTertiary, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '85%', padding: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Brand.text },
  packageList: { gap: 8 },
  packageListItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: Brand.surfaceAlt, borderRadius: 10,
  },
  packageListInfo: { flex: 1 },
  packageListName: { fontSize: 15, fontWeight: '600', color: Brand.text },
  packageListDesc: { fontSize: 12, color: Brand.textTertiary },
  packageListPrice: { fontSize: 15, fontWeight: '700', color: Brand.primary },
  formContainer: { gap: 12 },
  formLabel: { fontSize: 14, fontWeight: '600', color: Brand.text },
  formInput: {
    borderWidth: 1, borderColor: Brand.border, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Brand.text,
  },
  purchaseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, paddingVertical: 14, borderRadius: 10, marginTop: 8,
  },
  purchaseBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
