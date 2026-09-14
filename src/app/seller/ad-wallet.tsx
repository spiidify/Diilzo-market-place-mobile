import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { useScreenshotPrevention } from '@/hooks/useScreenshotPrevention';
import {
  getAdTransactions,
  getAdWallet,
  topUpAdWallet,
  type AdTransaction,
  type AdWalletResponse,
} from '@/services/financial';

export default function SellerAdWalletScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  useScreenshotPrevention(true);
  const [wallet, setWallet] = useState<AdWalletResponse | null>(null);
  const [transactions, setTransactions] = useState<AdTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpMethod, setTopUpMethod] = useState('mtn_momo');
  const [toppingUp, setToppingUp] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const [walletRes, txRes] = await Promise.all([
        getAdWallet(),
        getAdTransactions().catch(() => ({ transactions: [] })),
      ]);
      setWallet(walletRes);
      setTransactions(txRes.transactions || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load ad wallet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (v: string | number | undefined | null) => Number(v || 0).toLocaleString();

  const handleTopUp = async () => {
    const amount = Number(topUpAmount);
    if (!amount || amount < 5000) {
      Alert.alert('Invalid Amount', 'Minimum top-up is UGX 5,000');
      return;
    }
    try {
      setToppingUp(true);
      const ref = `ADTOP-${Date.now()}`;
      await topUpAdWallet({
        amount: topUpAmount,
        payment_reference: ref,
        payment_method: topUpMethod,
      });
      setTopUpAmount('');
      Alert.alert('Success', `Topped up UGX ${fmt(amount)}`);
      await load();
    } catch (e: any) {
      Alert.alert('Top-up Failed', e?.message || 'Please try again');
    } finally {
      setToppingUp(false);
    }
  };

  const renderTx = ({ item }: { item: AdTransaction }) => {
    const isCredit = item.transaction_type === 'top_up' || item.transaction_type === 'refund';
    return (
      <View style={styles.txRow}>
        <View style={[styles.txIcon, { backgroundColor: isCredit ? '#16A34A20' : '#DC262620' }]}>
          <MaterialCommunityIcons
            name={isCredit ? 'plus-circle' : 'minus-circle'}
            size={18}
            color={isCredit ? Brand.success : Brand.danger}
          />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txType}>{item.transaction_type.replace('_', ' ').toUpperCase()}</Text>
          <Text style={styles.txDesc} numberOfLines={1}>{item.description || '—'}</Text>
          <Text style={styles.txDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
        <View style={styles.txAmountCol}>
          <Text style={[styles.txAmount, { color: isCredit ? Brand.success : Brand.danger }]}>
            {isCredit ? '+' : '-'}UGX {fmt(item.amount)}
          </Text>
          <Text style={styles.txStatus}>{item.status}</Text>
        </View>
      </View>
    );
  };

  if (loading && !wallet) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Ad Wallet" subtitle="Prepaid advertising balance" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (error && !wallet) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Ad Wallet" subtitle="Prepaid advertising balance" />
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

  return (
    <View style={styles.screen}>
      <ModernHeader title="Ad Wallet" subtitle="Prepaid advertising balance" />
      <FlatList
        data={transactions}
        keyExtractor={(item) => `${item.id}`}
        renderItem={renderTx}
        maxToRenderPerBatch={10}
        windowSize={11}
        initialNumToRender={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            {/* Balance KPIs */}
            <View style={styles.kpiRow}>
              <View style={[styles.kpiCard, { backgroundColor: Brand.primary }]}>
                <MaterialCommunityIcons name="wallet" size={22} color="#FFFFFF" />
                <Text style={styles.kpiLabel}>Balance</Text>
                <Text style={styles.kpiValue}>UGX {fmt(wallet?.wallet_balance)}</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: Brand.danger }]}>
                <MaterialCommunityIcons name="bullhorn" size={22} color="#FFFFFF" />
                <Text style={styles.kpiLabel}>Spend (30d)</Text>
                <Text style={styles.kpiValue}>UGX {fmt(wallet?.spend_30d?.total_spend)}</Text>
              </View>
            </View>

            <View style={styles.kpiRow}>
              <View style={[styles.kpiCard, { backgroundColor: Brand.success }]}>
                <MaterialCommunityIcons name="plus-circle" size={22} color="#FFFFFF" />
                <Text style={styles.kpiLabel}>Top-ups (30d)</Text>
                <Text style={styles.kpiValue}>UGX {fmt(wallet?.spend_30d?.top_ups)}</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: Brand.rating }]}>
                <MaterialCommunityIcons name="cursor-default-click" size={22} color="#FFFFFF" />
                <Text style={styles.kpiLabel}>Clicks (30d)</Text>
                <Text style={styles.kpiValue}>{fmt(wallet?.spend_30d?.click_count)}</Text>
              </View>
            </View>

            {/* Top up form */}
            <View style={styles.topUpCard}>
              <Text style={styles.topUpTitle}>Top Up Ad Wallet</Text>
              <Text style={styles.topUpSubtitle}>
                Charges are deducted per click (CPC) or per 1000 impressions (CPM).
              </Text>
              <TextInput
                style={styles.topUpInput}
                placeholder="Amount (UGX) — min 5,000"
                keyboardType="numeric"
                value={topUpAmount}
                onChangeText={setTopUpAmount}
              />
              <View style={styles.methodRow}>
                {[
                  { code: 'mtn_momo', label: 'MTN MoMo' },
                  { code: 'airtel_money', label: 'Airtel' },
                  { code: 'card', label: 'Card' },
                ].map((m) => (
                  <Pressable
                    key={m.code}
                    style={[styles.methodBtn, topUpMethod === m.code && { borderColor: Brand.primary, backgroundColor: '#DCF5EC' }]}
                    onPress={() => setTopUpMethod(m.code)}
                  >
                    <Text style={styles.methodText}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={[styles.topUpBtn, toppingUp && { opacity: 0.6 }]}
                onPress={handleTopUp}
                disabled={toppingUp || !topUpAmount}
              >
                <Text style={styles.topUpBtnText}>{toppingUp ? 'Processing...' : 'Top Up'}</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Transaction History</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="bullhorn-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No ad transactions yet</Text>
            <Text style={styles.emptySubtext}>Top up your wallet to start advertising</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  emptyText: { marginTop: 12, fontSize: 14, color: c.textSecondary, fontWeight: '600' },
  emptySubtext: { marginTop: 4, fontSize: 12, color: c.textTertiary },

  list: { padding: 12, paddingBottom: 32 },

  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiCard: {
    flex: 1, borderRadius: 16, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  kpiLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 6 },
  kpiValue: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },

  topUpCard: {
    backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 16,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  topUpTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 4 },
  topUpSubtitle: { fontSize: 12, color: c.textSecondary, marginBottom: 12 },
  topUpInput: {
    backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, borderWidth: 1, borderColor: c.border, marginBottom: 10,
  },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  methodBtn: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 10, alignItems: 'center' },
  methodText: { fontSize: 12, fontWeight: '600', color: c.text },
  topUpBtn: { backgroundColor: Brand.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  topUpBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 10, marginTop: 4 },

  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 8,
  },
  txIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1, gap: 2 },
  txType: { fontSize: 12, fontWeight: '700', color: c.text },
  txDesc: { fontSize: 12, color: c.textSecondary },
  txDate: { fontSize: 11, color: c.textTertiary },
  txAmountCol: { alignItems: 'flex-end' },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txStatus: { fontSize: 11, color: c.textTertiary, textTransform: 'capitalize' },
});
