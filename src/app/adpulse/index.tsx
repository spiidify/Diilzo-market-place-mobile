import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import {
  createAdCampaign,
  getAdCampaigns,
  getAdPulseAnalytics,
  type AdCampaign,
  type AdPulseAnalytics,
} from '@/services/dashboardApi';

export default function AdPulseStudioScreen() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [analytics, setAnalytics] = useState<AdPulseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // ── Create form state ───────────────────────────────────────────
  const [formName, setFormName] = useState('');
  const [formProductId, setFormProductId] = useState('');
  const [formKeywords, setFormKeywords] = useState('');
  const [formDailyBudget, setFormDailyBudget] = useState('');
  const [formBidPerClick, setFormBidPerClick] = useState('50');

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const [campData, anData] = await Promise.all([
        getAdCampaigns().catch(() => [] as AdCampaign[]),
        getAdPulseAnalytics().catch(() => null),
      ]);
      setCampaigns(campData);
      setAnalytics(anData);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load AdPulse data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

    setCreating(true);
    try {
      const payload: any = {
        name,
        daily_budget: dailyBudget,
        bid_per_click: parseFloat(formBidPerClick) || 50,
      };
      if (formProductId.trim()) {
        payload.target_product_id = parseInt(formProductId, 10);
      }
      if (formKeywords.trim()) {
        payload.target_keywords = formKeywords.trim();
      }

      const newCampaign = await createAdCampaign(payload);
      setCampaigns((prev) => [newCampaign, ...prev]);
      setShowCreateModal(false);
      setFormName('');
      setFormProductId('');
      setFormKeywords('');
      setFormDailyBudget('');
      setFormBidPerClick('50');
      Alert.alert('Success', `Campaign "${newCampaign.name}" launched!`);
      load();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.data?.account_balance) {
        Alert.alert(
          'Insufficient Balance',
          `Your account balance is ${e.response.data.account_balance} UGX but the daily budget is ${e.response.data.daily_budget} UGX.`
        );
      } else {
        Alert.alert('Error', detail || e?.message || 'Failed to create campaign');
      }
    } finally {
      setCreating(false);
    }
  };

  const analyticsCards = [
    { icon: 'bullhorn', label: 'Total Campaigns', value: analytics?.total_campaigns, color: '#3B82F6' },
    { icon: 'play-circle', label: 'Active', value: analytics?.active_campaigns, color: Brand.primary },
    { icon: 'mouse-pointer', label: 'Total Clicks', value: analytics?.total_clicks, color: '#EC4899' },
    { icon: 'eye', label: 'Impressions', value: analytics?.total_impressions, color: '#8B5CF6' },
    { icon: 'percent', label: 'Avg CTR', value: analytics ? `${analytics.avg_ctr.toFixed(2)}%` : '—', color: '#F59E0B' },
    { icon: 'wallet', label: 'Total Spend', value: analytics ? Number(analytics.total_spend).toLocaleString() : '—', color: '#06B6D4' },
  ];

  if (loading && campaigns.length === 0) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading AdPulse Studio...</Text>
          </View>
        </SafeAreaView>
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
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.primary, Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>AdPulse Studio</Text>
            <Text style={styles.headerSub}>Marketing & Promotions</Text>
          </View>
          <Pressable onPress={() => setShowCreateModal(true)} hitSlop={12}>
            <MaterialCommunityIcons name="plus-circle" size={26} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>

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
            <Pressable style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
              <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
              <Text style={styles.createBtnText}>Create</Text>
            </Pressable>
          </View>

          <FlatList
            data={campaigns}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderCampaign}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="bullhorn-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No campaigns yet</Text>
                <Text style={styles.emptySub}>Tap "Create" to launch your first ad</Text>
              </View>
            }
          />
        </ScrollView>

        {/* ── Create Campaign Modal ────────────────────────────────── */}
        <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create New Campaign</Text>
                <Pressable onPress={() => setShowCreateModal(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
                </Pressable>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Campaign Name *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="e.g. Summer Boost 2026"
                  placeholderTextColor={Brand.textTertiary}
                />
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Target Product ID</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formProductId}
                    onChangeText={setFormProductId}
                    placeholder="optional"
                    placeholderTextColor={Brand.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Keywords</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formKeywords}
                    onChangeText={setFormKeywords}
                    placeholder="e.g. audio, tech"
                    placeholderTextColor={Brand.textTertiary}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Daily Budget (UGX) *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formDailyBudget}
                    onChangeText={setFormDailyBudget}
                    placeholder="e.g. 50000"
                    placeholderTextColor={Brand.textTertiary}
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
                    placeholderTextColor={Brand.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [styles.launchBtn, (creating || pressed) && { opacity: 0.85 }]}
                onPress={handleCreateCampaign}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="rocket-launch" size={18} color="#FFFFFF" />
                    <Text style={styles.launchBtnText}>Launch Campaign</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { marginTop: 8, color: Brand.textSecondary, fontSize: 14 },

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
    flex: 1, minWidth: '31%', backgroundColor: '#FFFFFF',
    borderRadius: 14, padding: 14, gap: 6,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  analyticsIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  analyticsValue: { fontSize: 20, fontWeight: '800', color: Brand.text },
  analyticsLabel: { fontSize: 10, color: Brand.textSecondary, fontWeight: '600' },

  // ── Section header ──────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 20, paddingBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.text },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Brand.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  createBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // ── Campaign card ───────────────────────────────────────────────
  campaignCard: {
    backgroundColor: '#FFFFFF', marginHorizontal: 12, marginBottom: 10,
    padding: 16, borderRadius: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  campaignHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  campaignName: { fontSize: 15, fontWeight: '800', color: Brand.text, flex: 1, marginRight: 8 },
  campaignStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  campaignStatusText: { fontSize: 11, fontWeight: '700' },
  campaignProduct: { fontSize: 12, color: Brand.textSecondary, marginBottom: 10 },
  campaignMetrics: {
    flexDirection: 'row', gap: 8, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Brand.borderLight,
  },
  metricItem: { flex: 1, alignItems: 'center' },
  metricItemValue: { fontSize: 14, fontWeight: '800', color: Brand.text },
  metricItemLabel: { fontSize: 10, color: Brand.textTertiary, marginTop: 2 },

  budgetBar: {
    height: 6, backgroundColor: Brand.borderLight, borderRadius: 3, overflow: 'hidden', marginTop: 8,
  },
  budgetFill: { height: '100%', borderRadius: 3 },
  budgetText: { fontSize: 11, color: Brand.textSecondary, marginTop: 4 },

  // ── Empty state ────────────────────────────────────────────────
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },

  // ── Modal ──────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },

  formGroup: { marginBottom: 14, flex: 1 },
  formRow: { flexDirection: 'row', gap: 12 },
  formLabel: { fontSize: 13, fontWeight: '700', color: Brand.text, marginBottom: 6 },
  formInput: {
    borderWidth: 1.5, borderColor: Brand.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Brand.text,
  },

  launchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, marginTop: 20, paddingVertical: 14, borderRadius: 12,
  },
  launchBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
