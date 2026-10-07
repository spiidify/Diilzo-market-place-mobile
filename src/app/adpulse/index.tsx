import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import {
  createAdCampaign,
  getAdCampaigns,
  getAdPulseAnalytics,
  updateAdCampaign,
  type AdCampaign,
  type AdPulseAnalytics,
} from '@/services/dashboardApi';
import { getAdWallet } from '@/services/financial';
import { getMyProducts } from '@/services/seller';

export default function AdPulseStudioScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [analytics, setAnalytics] = useState<AdPulseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [actingOn, setActingOn] = useState<number | null>(null);

  // ── Create form state ───────────────────────────────────────────
  const [formName, setFormName] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<{ id: number; name: string } | null>(null);
  const [formKeywords, setFormKeywords] = useState('');
  const [formDailyBudget, setFormDailyBudget] = useState('');
  const [formBidPerClick, setFormBidPerClick] = useState('50');
  const [formEndDate, setFormEndDate] = useState(''); // YYYY-MM-DD, optional

  // ── Product picker + ad wallet ──────────────────────────────────
  const [products, setProducts] = useState<any[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const params = useLocalSearchParams<{ product?: string }>();
  const preselectDone = useRef(false);
  // Tracks auto-filled values so we never overwrite seller edits.
  const autoFill = useRef({ name: '', keywords: '' });

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const [campData, anData, prodData, walletData] = await Promise.all([
        getAdCampaigns().catch(() => [] as AdCampaign[]),
        getAdPulseAnalytics().catch(() => null),
        getMyProducts({ page_size: 200 }).catch(() => [] as any[]),
        getAdWallet().catch(() => null),
      ]);
      setCampaigns(campData);
      setAnalytics(anData);
      setProducts(prodData);
      const wb = walletData?.wallet_balance;
      setWalletBalance(wb !== undefined && wb !== null ? parseFloat(String(wb)) : null);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load AdPulse data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fill campaign name/keywords from the chosen product — only when
  // the field is empty or still holds our own autofill value.
  const applyProduct = useCallback((p: { id: number; name: string } | null) => {
    setSelectedProduct(p);
    if (!p || editingId) return;
    setFormName((prev) => {
      if (!prev || prev === autoFill.current.name) {
        const v = `Boost — ${p.name}`;
        autoFill.current.name = v;
        return v;
      }
      return prev;
    });
    setFormKeywords((prev) => {
      if (!prev || prev === autoFill.current.keywords) {
        const v = (p.name || '').split(/\s+/).slice(0, 5).join(' ');
        autoFill.current.keywords = v;
        return v;
      }
      return prev;
    });
  }, [editingId]);

  // Deep link: /adpulse?product=<id> from a "Boost" button — select the
  // product, auto-fill everything, and open the create modal once.
  useEffect(() => {
    if (preselectDone.current || !params.product || products.length === 0) return;
    const p = products.find((x) => String(x.id) === String(params.product));
    if (p) {
      preselectDone.current = true;
      applyProduct({ id: p.id, name: p.name });
      setShowCreateModal(true);
    }
  }, [params.product, products, applyProduct]);

  const resetForm = useCallback(() => {
    setFormName('');
    setSelectedProduct(null);
    autoFill.current = { name: '', keywords: '' };
    setFormKeywords('');
    setFormDailyBudget('');
    setFormBidPerClick('50');
    setFormEndDate('');
    setEditingId(null);
  }, []);

  // Open the modal pre-filled for editing an existing campaign.
  const openEdit = useCallback((c: AdCampaign) => {
    setEditingId(c.id);
    setFormName(c.name || '');
    setSelectedProduct(c.target_product ? { id: c.target_product, name: c.target_product_name } : null);
    setFormKeywords(c.target_keywords || '');
    setFormDailyBudget(String(c.daily_budget || ''));
    setFormBidPerClick(String(c.bid_per_click || '50'));
    setFormEndDate(c.ends_at ? c.ends_at.slice(0, 10) : '');
    setShowCreateModal(true);
  }, []);

  // Pause / resume a campaign from its card.
  const toggleCampaign = useCallback(async (c: AdCampaign, to: 'PAUSED' | 'ACTIVE') => {
    setActingOn(c.id);
    try {
      const updated = await updateAdCampaign(c.id, { status: to });
      setCampaigns((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not update the campaign.');
    } finally {
      setActingOn(null);
    }
  }, [load]);

  const handleCreateCampaign = async () => {
    const name = formName.trim();
    const dailyBudget = parseFloat(formDailyBudget);

    if (!name) {
      Alert.alert('Validation', 'Please enter a campaign name.');
      return;
    }
    if (isNaN(dailyBudget) || dailyBudget < 0) {
      Alert.alert('Validation', 'Please enter a valid daily budget.');
      return;
    }

    // Optional end date (YYYY-MM-DD) — validate before submitting.
    const endDate = formEndDate.trim();
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      Alert.alert('Validation', 'End date must be YYYY-MM-DD (e.g. 2026-08-01).');
      return;
    }

    setCreating(true);
    try {
      const payload: any = {
        name,
        daily_budget: dailyBudget,
        bid_per_click: parseFloat(formBidPerClick) || 50,
      };
      if (selectedProduct && !editingId) {
        payload.target_product_id = selectedProduct.id;
      }
      if (formKeywords.trim()) {
        payload.target_keywords = formKeywords.trim();
      }
      // End date → end-of-day ISO; blank clears it in edit mode.
      if (endDate) {
        payload.ends_at = new Date(`${endDate}T23:59:59`).toISOString();
      } else if (editingId) {
        payload.ends_at = null;
      }

      const saved = editingId
        ? await updateAdCampaign(editingId, payload)
        : await createAdCampaign(payload);
      setCampaigns((prev) =>
        editingId ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev]
      );
      setShowCreateModal(false);
      resetForm();
      Alert.alert('Success', editingId ? `Campaign "${saved.name}" updated.` : `Campaign "${saved.name}" launched!`);
      load();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.data?.wallet_balance !== undefined) {
        Alert.alert(
          'Insufficient Ad Wallet Balance',
          `Your ad wallet has ${e.response.data.wallet_balance} UGX but the daily budget is ${e.response.data.daily_budget} UGX. Top up your Ad Wallet to launch this campaign.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Top Up Wallet', onPress: () => router.push('/seller/ad-wallet' as any) },
          ]
        );
      } else {
        Alert.alert('Error', detail || e?.message || 'Failed to save campaign');
      }
    } finally {
      setCreating(false);
    }
  };

  const analyticsCards = [
    { icon: 'bullhorn', label: 'Total Campaigns', value: analytics?.total_campaigns, color: '#3B82F6' },
    { icon: 'play-circle', label: 'Active', value: analytics?.active_campaigns, color: Brand.primary },
    { icon: 'cursor-default-click', label: 'Total Clicks', value: analytics?.total_clicks, color: '#EC4899' },
    { icon: 'eye', label: 'Impressions', value: analytics?.total_impressions, color: '#8B5CF6' },
    { icon: 'percent', label: 'Avg CTR', value: analytics ? `${analytics.avg_ctr.toFixed(2)}%` : '—', color: '#F59E0B' },
    { icon: 'wallet', label: 'Total Spend', value: analytics ? Number(analytics.total_spend).toLocaleString() : '—', color: '#06B6D4' },
  ];

  if (loading && campaigns.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="AdPulse Studio" subtitle="Marketing & Promotions" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
          <Text style={styles.loadingText}>Loading AdPulse Studio...</Text>
        </View>
      </View>
    );
  }

  const renderCampaign = ({ item }: { item: AdCampaign }) => {
    const statusColor =
      item.status === 'ACTIVE' ? Brand.primary :
        item.status === 'PAUSED' ? '#F59E0B' : '#06B6D4';
    const budgetUsed = Number(item.daily_budget) > 0
      ? Math.min(100, Math.round((Number(item.total_spend) / Number(item.daily_budget)) * 100))
      : 0;

    const serving = item.status === 'ACTIVE' ? item.is_serving : null;

    return (
      <View style={styles.campaignCard}>
        <View style={styles.campaignHeader}>
          <Text style={styles.campaignName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.campaignStatusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.campaignStatusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.campaignProduct}>
          {item.target_product_name || (item.target_product ? `Product #${item.target_product}` : 'Store-wide')}
        </Text>
        {serving !== null && (
          <View style={styles.servingRow}>
            <MaterialCommunityIcons
              name={serving ? 'check-circle' : 'alert-circle'}
              size={12}
              color={serving ? '#00b894' : '#e17055'}
            />
            <Text style={[styles.servingText, { color: serving ? '#00b894' : '#e17055' }]}>
              {serving ? 'Serving now' : 'Not serving — check wallet balance'}
            </Text>
          </View>
        )}
        <View style={styles.campaignMetrics}>
          <View style={styles.metricItem}>
            <Text style={styles.metricItemValue}>{Number(item.total_clicks).toLocaleString()}</Text>
            <Text style={styles.metricItemLabel}>Clicks</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricItemValue}>{Number(item.total_impressions).toLocaleString()}</Text>
            <Text style={styles.metricItemLabel}>Impr.</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricItemValue}>{item.click_through_rate.toFixed(1)}%</Text>
            <Text style={styles.metricItemLabel}>CTR</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricItemValue}>{Number(item.total_spend).toLocaleString()}</Text>
            <Text style={styles.metricItemLabel}>Spend</Text>
          </View>
        </View>
        <View style={styles.budgetBar}>
          <View style={[styles.budgetFill, { width: `${budgetUsed}%`, backgroundColor: budgetUsed > 80 ? Brand.danger : statusColor }]} />
        </View>
        <Text style={styles.budgetText}>
          Budget: UGX {Number(item.daily_budget).toLocaleString()}/day · {budgetUsed}% used
          {item.ends_at ? ` · ends ${item.ends_at.slice(0, 10)}` : ''}
        </Text>
        {item.status !== 'COMPLETED' && (
          <View style={styles.cardActions}>
            <Pressable
              style={styles.cardActionBtn}
              onPress={() => openEdit(item)}
              disabled={actingOn === item.id}
            >
              <MaterialCommunityIcons name="pencil" size={14} color={Brand.primary} />
              <Text style={[styles.cardActionText, { color: Brand.primary }]}>Edit</Text>
            </Pressable>
            <Pressable
              style={styles.cardActionBtn}
              onPress={() => toggleCampaign(item, item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')}
              disabled={actingOn === item.id}
            >
              {actingOn === item.id ? (
                <ActivityIndicator size={12} color={Brand.primary} />
              ) : (
                <MaterialCommunityIcons
                  name={item.status === 'ACTIVE' ? 'pause' : 'play'}
                  size={14}
                  color={item.status === 'ACTIVE' ? '#F59E0B' : '#00b894'}
                />
              )}
              <Text style={[styles.cardActionText, { color: item.status === 'ACTIVE' ? '#F59E0B' : '#00b894' }]}>
                {item.status === 'ACTIVE' ? 'Pause' : 'Resume'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader
        title="AdPulse Studio"
        subtitle="Marketing & Promotions"
        rightIcon="plus-circle"
        onRightPress={() => setShowCreateModal(true)}
      />

      {error ? (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="alert-circle" size={16} color={Brand.danger} />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
      >
        {/* ── Analytics cards ─────────────────────────────────────── */}
        <View style={styles.analyticsGrid}>
          {analyticsCards.map((card, index) => (
            <View key={`analytics-${index}`} style={styles.analyticsCard}>
              <View style={[styles.analyticsIconWrap, { backgroundColor: card.color + '20' }]}>
                <MaterialCommunityIcons name={card.icon as any} size={20} color={card.color} />
              </View>
              <Text style={styles.analyticsValue}>{card.value ?? '—'}</Text>
              <Text style={styles.analyticsLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Campaigns list ──────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Campaigns ({campaigns.length})</Text>
          <Pressable style={styles.createBtn} onPress={() => { resetForm(); setShowCreateModal(true); }}>
            <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.createBtnText}>Create</Text>
          </Pressable>
        </View>

        <View style={styles.filterChips}>
          {[['', 'All'], ['ACTIVE', 'Active'], ['PAUSED', 'Paused'], ['COMPLETED', 'Completed']].map(([val, label]) => (
            <Pressable
              key={val}
              style={[styles.filterChip, statusFilter === val && styles.filterChipActive]}
              onPress={() => setStatusFilter(val)}
            >
              <Text style={[styles.filterChipText, statusFilter === val && styles.filterChipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          data={campaigns.filter((c) => !statusFilter || c.status === statusFilter)}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCampaign}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="bullhorn-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No campaigns yet</Text>
              <Text style={styles.emptySub}>Tap "Create" to launch your first ad</Text>
            </View>
          }
        />
      </ScrollView>

      {/* ── Create / Edit Campaign Modal ─────────────────────────── */}
      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => { setShowCreateModal(false); resetForm(); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Campaign' : 'Create New Campaign'}</Text>
              <Pressable onPress={() => { setShowCreateModal(false); resetForm(); }} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textTertiary} />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Campaign Name *</Text>
              <TextInput
                style={styles.formInput}
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. Summer Boost 2026"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Product to Boost</Text>
              <Pressable
                style={[styles.pickerField, editingId !== null && { opacity: 0.55 }]}
                onPress={() => !editingId && setShowProductPicker(true)}
                disabled={editingId !== null}
              >
                <MaterialCommunityIcons name="package-variant" size={16} color={colors.textTertiary} />
                <Text
                  style={[styles.pickerText, !selectedProduct && { color: colors.textTertiary }]}
                  numberOfLines={1}
                >
                  {selectedProduct ? selectedProduct.name : 'Store-wide boost (all products)'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={colors.textTertiary} />
              </Pressable>
              {editingId !== null && (
                <Text style={styles.formHint}>Target product can't be changed on an existing campaign.</Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Keywords</Text>
              <TextInput
                style={styles.formInput}
                value={formKeywords}
                onChangeText={setFormKeywords}
                placeholder="e.g. audio, tech"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.formRow}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Daily Budget (UGX) *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formDailyBudget}
                  onChangeText={setFormDailyBudget}
                  placeholder="e.g. 50000"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Bid Per Click (UGX)</Text>
                <TextInput
                  style={styles.formInput}
                  value={formBidPerClick}
                  onChangeText={setFormBidPerClick}
                  placeholder="50"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>End Date (optional)</Text>
              <TextInput
                style={styles.formInput}
                value={formEndDate}
                onChangeText={setFormEndDate}
                placeholder="YYYY-MM-DD — leave blank to run until paused"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </View>

            {/* Estimated reach: clicks/day at this bid + wallet runway */}
            {(() => {
              const budget = parseFloat(formDailyBudget) || 0;
              const bid = parseFloat(formBidPerClick) || 0;
              if (budget <= 0 || bid <= 0) return null;
              const clicks = Math.floor(budget / bid);
              const runway = walletBalance !== null && budget > 0
                ? ` · wallet covers ~${Math.floor(walletBalance / budget)} day(s)`
                : '';
              return (
                <Text style={styles.reachHint}>
                  ≈ {clicks.toLocaleString()} click(s)/day at this bid{runway}
                </Text>
              );
            })()}

            {walletBalance !== null && (
              <View style={styles.walletRow}>
                <MaterialCommunityIcons name="wallet-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.walletText}>
                  Ad Wallet: UGX {walletBalance.toLocaleString()}
                </Text>
                {(parseFloat(formDailyBudget) || 0) > walletBalance && (
                  <Text style={styles.walletWarn}>Top up needed</Text>
                )}
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.launchBtn, (creating || pressed) && { opacity: 0.85 }]}
              onPress={handleCreateCampaign}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name={editingId ? 'content-save' : 'rocket-launch'} size={18} color="#FFFFFF" />
                  <Text style={styles.launchBtnText}>{editingId ? 'Save Changes' : 'Launch Campaign'}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Product Picker Modal ─────────────────────────────────── */}
      <Modal visible={showProductPicker} animationType="slide" transparent onRequestClose={() => setShowProductPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a Product</Text>
              <Pressable onPress={() => setShowProductPicker(false)} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textTertiary} />
              </Pressable>
            </View>
            <FlatList
              data={products}
              keyExtractor={(item) => String(item.id)}
              ListHeaderComponent={
                <Pressable
                  style={styles.pickerItem}
                  onPress={() => { applyProduct(null); setShowProductPicker(false); }}
                >
                  <View style={styles.pickerThumb}>
                    <MaterialCommunityIcons name="storefront-outline" size={18} color={Brand.primary} />
                  </View>
                  <Text style={styles.pickerItemText} numberOfLines={1}>Store-wide boost (all products)</Text>
                  {!selectedProduct && <MaterialCommunityIcons name="check" size={18} color={Brand.primary} />}
                </Pressable>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerItem}
                  onPress={() => { applyProduct({ id: item.id, name: item.name }); setShowProductPicker(false); }}
                >
                  {(item.primary_image_url || item.primary_image) ? (
                    <Image source={{ uri: item.primary_image_url || item.primary_image }} style={styles.pickerThumbImg} resizeMode="cover" />
                  ) : (
                    <View style={styles.pickerThumb}>
                      <MaterialCommunityIcons name="package-variant" size={18} color={colors.textTertiary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerItemText} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.pickerItemSub}>UGX {Number(item.final_price || item.price).toLocaleString()}</Text>
                  </View>
                  {selectedProduct?.id === item.id && <MaterialCommunityIcons name="check" size={18} color={Brand.primary} />}
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerItemSub}>No products yet — boost store-wide instead.</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { marginTop: 8, color: c.textSecondary, fontSize: 14 },

  body: { flex: 1 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(220,38,38,0.08)', marginHorizontal: 12, marginTop: 12,
    padding: 10, borderRadius: 8,
  },
  errorBannerText: { fontSize: 12, color: Brand.danger, fontWeight: '600', flex: 1 },

  // ── Analytics grid ─────────────────────────────────────────────
  analyticsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 12, paddingTop: 12,
  },
  analyticsCard: {
    flex: 1, minWidth: '31%', backgroundColor: c.surface,
    borderRadius: 14, padding: 14, gap: 6,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  analyticsIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  analyticsValue: { fontSize: 20, fontWeight: '800', color: c.text },
  analyticsLabel: { fontSize: 10, color: c.textSecondary, fontWeight: '600' },

  // ── Section header ──────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 20, paddingBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Brand.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  createBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // ── Campaign card ───────────────────────────────────────────────
  campaignCard: {
    backgroundColor: c.surface, marginHorizontal: 12, marginBottom: 10,
    padding: 8, borderRadius: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  campaignHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  campaignName: { fontSize: 15, fontWeight: '800', color: c.text, flex: 1, marginRight: 8 },
  campaignStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  campaignStatusText: { fontSize: 11, fontWeight: '700' },
  campaignProduct: { fontSize: 12, color: c.textSecondary, marginBottom: 10 },
  campaignMetrics: {
    flexDirection: 'row', gap: 8, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: c.borderLight,
  },
  metricItem: { flex: 1, alignItems: 'center' },
  metricItemValue: { fontSize: 14, fontWeight: '800', color: c.text },
  metricItemLabel: { fontSize: 10, color: c.textTertiary, marginTop: 2 },

  budgetBar: {
    height: 6, backgroundColor: c.borderLight, borderRadius: 3, overflow: 'hidden', marginTop: 8,
  },
  budgetFill: { height: '100%', borderRadius: 3 },
  budgetText: { fontSize: 11, color: c.textSecondary, marginTop: 4 },

  servingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -4, marginBottom: 8 },
  servingText: { fontSize: 11, fontWeight: '700' },

  cardActions: {
    flexDirection: 'row', gap: 8, marginTop: 10,
    borderTopWidth: 1, borderTopColor: c.borderLight, paddingTop: 10,
  },
  cardActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: c.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  cardActionText: { fontSize: 12, fontWeight: '700' },

  // ── Status filter chips ────────────────────────────────────────
  filterChips: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
  },
  filterChipActive: { backgroundColor: Brand.primary + '18', borderColor: Brand.primary },
  filterChipText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
  filterChipTextActive: { color: Brand.primary },

  formHint: { fontSize: 11, color: c.textTertiary, marginTop: 4 },
  reachHint: { fontSize: 12, color: c.textSecondary, marginBottom: 8, marginTop: -6 },

  // ── Empty state ────────────────────────────────────────────────
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: c.textSecondary },
  emptySub: { fontSize: 13, color: c.textTertiary },

  // ── Modal ──────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: c.text },

  formGroup: { marginBottom: 14, flex: 1 },
  formRow: { flexDirection: 'row', gap: 12 },
  formLabel: { fontSize: 13, fontWeight: '700', color: c.text, marginBottom: 6 },
  formInput: {
    borderWidth: 1.5, borderColor: c.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: c.text,
  },

  // ── Product picker ───────────────────────────────────────────
  pickerField: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: c.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  pickerText: { flex: 1, fontSize: 14, color: c.text, fontWeight: '600' },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.borderLight,
  },
  pickerItemText: { flex: 1, fontSize: 14, fontWeight: '600', color: c.text },
  pickerItemSub: { fontSize: 12, color: c.textTertiary, marginTop: 1 },
  pickerThumb: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: c.surfaceAlt,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  pickerThumbImg: { width: 36, height: 36, borderRadius: 8 },
  pickerEmpty: { alignItems: 'center', paddingVertical: 32 },

  // ── Wallet balance row ───────────────────────────────────────
  walletRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: c.surfaceAlt, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 4,
  },
  walletText: { flex: 1, fontSize: 12, fontWeight: '600', color: c.textSecondary },
  walletWarn: { fontSize: 11, fontWeight: '800', color: Brand.danger },

  launchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, marginTop: 20, paddingVertical: 14, borderRadius: 12,
  },
  launchBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
