import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

import { GradientHeader } from '@/components/GradientHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { apiRequest } from '@/services/api';

// ── Types ─────────────────────────────────────────────────────────
interface SavedPaymentMethod {
  id: number;
  method: string;
  label: string;
  last4?: string;
  expiry?: string;
  is_default: boolean;
  created_at: string;
}

interface Transaction {
  id: number;
  order_number: string;
  amount: string;
  method: string;
  status: string;
  created_at: string;
}

// ── Payment method display config ─────────────────────────────────
const METHOD_CONFIG: Record<string, {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  color: string;
}> = {
  mtn_momo: { icon: 'cellphone', label: 'MTN MoMo', color: '#FFCC00' },
  airtel_money: { icon: 'cellphone-link', label: 'Airtel Money', color: '#DC2626' },
  paypal: { icon: 'credit-card-outline', label: 'PayPal', color: '#003087' },
  cod: { icon: 'cash', label: 'Cash on Delivery', color: Brand.success },
  card: { icon: 'credit-card', label: 'Card', color: '#3B82F6' },
  default: { icon: 'credit-card-outline', label: 'Payment Method', color: Brand.primary },
};

function getMethodConfig(method: string) {
  return METHOD_CONFIG[method] || METHOD_CONFIG.default;
}

const STATUS_COLORS: Record<string, string> = {
  completed: Brand.success,
  success: Brand.success,
  paid: Brand.success,
  pending: Brand.rating,
  failed: Brand.danger,
  cancelled: Brand.danger,
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function PaymentsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);

      let savedMethods: SavedPaymentMethod[] = [];
      try {
        const data = await apiRequest<{ results: SavedPaymentMethod[] } | SavedPaymentMethod[]>({
          method: 'GET',
          url: '/payments/methods/saved/',
        });
        savedMethods = Array.isArray(data) ? data : data.results || [];
      } catch {
        // Endpoint may not exist — use empty list
      }
      setMethods(savedMethods);

      let txns: Transaction[] = [];
      try {
        const data = await apiRequest<{ results: Transaction[] } | Transaction[]>({
          method: 'GET',
          url: '/payments/transactions/',
        });
        txns = Array.isArray(data) ? data : data.results || [];
      } catch {
        // Endpoint may not exist — use empty list
      }
      setTransactions(txns);
    } catch (e: any) {
      setError(e?.message || 'Failed to load payment data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddMethod = () => {
    Alert.alert(
      'Add Payment Method',
      'Choose a payment method to add:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'MTN MoMo',
          onPress: () => Alert.alert(
            'MTN MoMo',
            'Your MTN MoMo number will be collected at checkout. You can use it directly when placing an order.',
            [{ text: 'OK' }]
          ),
        },
        {
          text: 'Airtel Money',
          onPress: () => Alert.alert(
            'Airtel Money',
            'Your Airtel Money number will be collected at checkout. You can use it directly when placing an order.',
            [{ text: 'OK' }]
          ),
        },
        { text: 'PayPal', onPress: () => Alert.alert('Coming Soon', 'PayPal integration coming soon!') },
      ]
    );
  };

  const handleSetDefault = async (method: SavedPaymentMethod) => {
    try {
      await apiRequest({
        method: 'PATCH',
        url: `/payments/methods/saved/${method.id}/`,
        data: { is_default: true },
      });
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to set default payment method');
    }
  };

  const handleRemoveMethod = (method: SavedPaymentMethod) => {
    Alert.alert(
      'Remove Payment Method',
      `Remove ${method.label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest({
                method: 'DELETE',
                url: `/payments/methods/saved/${method.id}/`,
              });
              load();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to remove payment method');
            }
          },
        },
      ]
    );
  };

  const subtitle = !loading
    ? `${methods.length} saved · ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`
    : undefined;

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Payments"
        subtitle={subtitle}
        rightIcon="plus"
        onRightPress={handleAddMethod}
      />

      {loading ? (
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={44} color={Brand.danger} />
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
          {/* ── Saved methods ─────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Saved Methods</Text>
            {methods.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>No saved payment methods</Text>
                <Text style={styles.emptySub}>Add one for faster checkout</Text>
              </View>
            ) : (
              methods.map((method, i) => {
                const config = getMethodConfig(method.method);
                return (
                  <View key={`pm-${method.id}`}>
                    {i > 0 && <View style={styles.rowDivider} />}
                    <View style={styles.row}>
                      <View style={[styles.iconWrap, { backgroundColor: config.color + '18' }]}>
                        <MaterialCommunityIcons name={config.icon} size={18} color={config.color} />
                      </View>
                      <View style={styles.info}>
                        <View style={styles.titleRow}>
                          <Text style={styles.rowTitle} numberOfLines={1}>{method.label || config.label}</Text>
                          {method.is_default && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>Default</Text>
                            </View>
                          )}
                        </View>
                        {(method.last4 || method.expiry) ? (
                          <Text style={styles.rowMeta} numberOfLines={1}>
                            {[method.last4 ? `•••• ${method.last4}` : null, method.expiry ? `exp ${method.expiry}` : null].filter(Boolean).join(' · ')}
                          </Text>
                        ) : null}
                      </View>
                      {!method.is_default && (
                        <Pressable style={styles.iconBtn} onPress={() => handleSetDefault(method)} hitSlop={4}>
                          <MaterialCommunityIcons name="star-outline" size={17} color={colors.textSecondary} />
                        </Pressable>
                      )}
                      <Pressable style={styles.iconBtn} onPress={() => handleRemoveMethod(method)} hitSlop={4}>
                        <MaterialCommunityIcons name="trash-can-outline" size={17} color={Brand.danger} />
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
            <View style={styles.rowDivider} />
            <Pressable
              style={({ pressed }) => [styles.addRow, pressed && { backgroundColor: colors.surfaceAlt }]}
              onPress={handleAddMethod}
            >
              <View style={[styles.iconWrap, { backgroundColor: Brand.primary + '12' }]}>
                <MaterialCommunityIcons name="plus" size={18} color={Brand.primary} />
              </View>
              <Text style={styles.addRowText}>Add payment method</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textTertiary} />
            </Pressable>
          </View>

          {/* ── Transaction history ───────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.cardHeadRow}>
              <Text style={styles.cardTitle}>Transaction History</Text>
              {transactions.length > 10 && (
                <Pressable style={styles.viewAll} onPress={() => router.push('/buyer/orders' as any)} hitSlop={8}>
                  <Text style={styles.viewAllText}>View all</Text>
                  <MaterialCommunityIcons name="chevron-right" size={14} color={Brand.primary} />
                </Pressable>
              )}
            </View>
            {transactions.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>No transactions yet</Text>
                <Text style={styles.emptySub}>Your payment history will appear here</Text>
              </View>
            ) : (
              transactions.slice(0, 10).map((txn, i) => {
                const config = getMethodConfig(txn.method);
                const statusColor = STATUS_COLORS[txn.status] || colors.textTertiary;
                return (
                  <View key={`txn-${txn.id}`}>
                    {i > 0 && <View style={styles.rowDivider} />}
                    <View style={styles.row}>
                      <View style={[styles.iconWrap, { backgroundColor: config.color + '18' }]}>
                        <MaterialCommunityIcons name={config.icon} size={16} color={config.color} />
                      </View>
                      <View style={styles.info}>
                        <Text style={styles.rowTitle} numberOfLines={1}>Order #{txn.order_number}</Text>
                        <Text style={styles.rowMeta}>{config.label} · {formatDate(txn.created_at)}</Text>
                      </View>
                      <View style={styles.txnRight}>
                        <Text style={styles.txnAmount}>UGX {Number(txn.amount).toLocaleString()}</Text>
                        <Text style={[styles.txnStatus, { color: statusColor }]}>
                          {txn.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorText: { marginTop: 10, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  body: { flex: 1 },
  bodyContent: { paddingTop: 10, paddingBottom: 32, gap: 10 },

  card: {
    backgroundColor: c.surface, marginHorizontal: 10, borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 12,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  cardHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 12, fontWeight: '800', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, marginTop: 2 },
  viewAll: { flexDirection: 'row', alignItems: 'center' },
  viewAllText: { fontSize: 12, fontWeight: '700', color: Brand.primary },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 2,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1, gap: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: c.text },
  rowMeta: { fontSize: 11, color: c.textTertiary, fontWeight: '500' },
  defaultBadge: {
    backgroundColor: Brand.primary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5,
  },
  defaultBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  iconBtn: { padding: 6 },
  rowDivider: { height: 1, backgroundColor: c.borderLight, marginLeft: 44 },

  emptyRow: { alignItems: 'center', paddingVertical: 14, gap: 2 },
  emptyText: { fontSize: 13, fontWeight: '700', color: c.textSecondary },
  emptySub: { fontSize: 11, color: c.textTertiary },

  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 2, borderRadius: 8,
  },
  addRowText: { flex: 1, fontSize: 13, fontWeight: '700', color: Brand.primary },

  txnRight: { alignItems: 'flex-end', gap: 1 },
  txnAmount: { fontSize: 13, fontWeight: '800', color: c.text },
  txnStatus: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
});
