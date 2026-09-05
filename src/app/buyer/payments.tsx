import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
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
  refunded: Brand.textTertiary,
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function PaymentsScreen() {
  const router = useRouter();
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);

      // Fetch saved payment methods
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

      // Fetch transaction history
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

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const config = getMethodConfig(item.method);
    const statusColor = STATUS_COLORS[item.status] || Brand.textTertiary;
    return (
      <View style={styles.txnCard}>
        <View style={[styles.txnIcon, { backgroundColor: config.color + '20' }]}>
          <MaterialCommunityIcons name={config.icon} size={20} color={config.color} />
        </View>
        <View style={styles.txnInfo}>
          <Text style={styles.txnOrder}>Order #{item.order_number}</Text>
          <Text style={styles.txnDate}>{formatDate(item.created_at)}</Text>
        </View>
        <View style={styles.txnRight}>
          <Text style={styles.txnAmount}>UGX {Number(item.amount).toLocaleString()}</Text>
          <View style={[styles.txnStatusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.txnStatusText, { color: statusColor }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
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
            <Text style={styles.headerTitle}>Payment Methods</Text>
            <View style={{ width: 24 }} />
          </LinearGradient>
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>Payment Methods</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

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
          {/* Saved payment methods */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="wallet-outline" size={20} color={Brand.primary} />
              <Text style={styles.sectionTitle}>Saved Methods</Text>
            </View>

            {methods.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="credit-card-off-outline" size={40} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No saved payment methods</Text>
                <Text style={styles.emptySubtext}>Add a payment method for faster checkout</Text>
              </View>
            ) : (
              methods.map((method) => {
                const config = getMethodConfig(method.method);
                return (
                  <View key={`pm-${method.id}`} style={styles.methodCard}>
                    <View style={[styles.methodIcon, { backgroundColor: config.color + '20' }]}>
                      <MaterialCommunityIcons name={config.icon} size={24} color={config.color} />
                    </View>
                    <View style={styles.methodInfo}>
                      <View style={styles.methodHeader}>
                        <Text style={styles.methodLabel}>{method.label || config.label}</Text>
                        {method.is_default && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      {method.last4 && (
                        <Text style={styles.methodDetail}>•••• {method.last4}</Text>
                      )}
                      {method.expiry && (
                        <Text style={styles.methodDetail}>Expires {method.expiry}</Text>
                      )}
                    </View>
                    <View style={styles.methodActions}>
                      {!method.is_default && (
                        <Pressable
                          style={styles.methodActionBtn}
                          onPress={() => handleSetDefault(method)}
                        >
                          <MaterialCommunityIcons name="star-outline" size={18} color={Brand.textSecondary} />
                        </Pressable>
                      )}
                      <Pressable
                        style={styles.methodActionBtn}
                        onPress={() => handleRemoveMethod(method)}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={Brand.danger} />
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}

            {/* Add payment method button */}
            <Pressable
              style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
              onPress={handleAddMethod}
            >
              <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add Payment Method</Text>
            </Pressable>
          </View>

          {/* Transaction history */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="history" size={20} color={Brand.primary} />
              <Text style={styles.sectionTitle}>Transaction History</Text>
            </View>

            {transactions.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="receipt-text-outline" size={40} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No transactions yet</Text>
                <Text style={styles.emptySubtext}>Your payment history will appear here</Text>
              </View>
            ) : (
              <View style={styles.txnListWrap}>
                {transactions.slice(0, 10).map((txn) => (
                  <View key={`txn-${txn.id}`}>
                    {renderTransaction({ item: txn })}
                  </View>
                ))}
                {transactions.length > 10 && (
                  <Pressable
                    style={({ pressed }) => [styles.viewAllBtn, pressed && { opacity: 0.85 }]}
                    onPress={() => router.push('/buyer/orders' as any)}
                  >
                    <Text style={styles.viewAllText}>View All Orders</Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={Brand.primary} />
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.three, paddingBottom: Spacing.six },

  // Sections
  section: { marginBottom: Spacing.three },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.text },

  // Empty state
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  emptyText: { fontSize: 15, fontWeight: '700', color: Brand.text },
  emptySubtext: { fontSize: 13, color: Brand.textSecondary, textAlign: 'center' },

  // Method cards
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodInfo: { flex: 1, gap: 2 },
  methodHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  methodLabel: { fontSize: 15, fontWeight: '700', color: Brand.text },
  defaultBadge: {
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  methodDetail: { fontSize: 13, color: Brand.textSecondary },
  methodActions: { flexDirection: 'row', gap: Spacing.two },
  methodActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Brand.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Add button
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: Brand.primary,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
    borderRadius: 12,
    marginTop: Spacing.two,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  // Transactions
  txnListWrap: { gap: Spacing.two },
  txnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: Spacing.three,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txnInfo: { flex: 1, gap: 2 },
  txnOrder: { fontSize: 14, fontWeight: '600', color: Brand.text },
  txnDate: { fontSize: 12, color: Brand.textTertiary },
  txnRight: { alignItems: 'flex-end', gap: 4 },
  txnAmount: { fontSize: 15, fontWeight: '700', color: Brand.text },
  txnStatusBadge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 6 },
  txnStatusText: { fontSize: 11, fontWeight: '700' },

  // View all
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one + 2,
    paddingVertical: Spacing.two + Spacing.one,
    marginTop: Spacing.one + 2,
  },
  viewAllText: { fontSize: 14, fontWeight: '700', color: Brand.primary },
});
