import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import {
  fetchSellerCustomerDetail,
  updateSellerCustomer,
} from '@/services/connection';
import type { StoreCustomer } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  new: '#3B82F6',
  active: '#10B981',
  repeat: '#8B5CF6',
  vip: '#F59E0B',
  churned: '#EF4444',
};

export default function SellerCustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const customerId = Number(id);
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [customer, setCustomer] = useState<StoreCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!customerId) return;
    try {
      setError(null);
      const data = await fetchSellerCustomerDetail(customerId);
      setCustomer(data);
      setNotes(data.notes || '');
      setTags(data.tags || '');
    } catch (e: any) {
      setError(e?.message || 'Failed to load customer');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateSellerCustomer(customerId, { notes, tags });
      setCustomer(updated);
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Customer</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !customer) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Customer</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!customer) return null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Customer</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* ── Customer header ─────────────────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{customer.name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{customer.name}</Text>
            <Text style={styles.email}>{customer.email}</Text>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[customer.status] || '#6B7280' }]}>
              <Text style={styles.statusText}>{customer.status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* ── Stats ───────────────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{customer.total_orders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{customer.total_spent}</Text>
            <Text style={styles.statLabel}>Spent (UGX)</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{customer.loyalty_points || 0}</Text>
            <Text style={styles.statLabel}>Loyalty Points</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
            </Text>
            <Text style={styles.statLabel}>Last Order</Text>
          </View>
        </View>

        {/* ── CRM Notes & Tags ───────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Notes & Tags</Text>
          <Text style={styles.inputLabel}>Tags (comma-separated)</Text>
          <TextInput
            style={styles.input}
            value={tags}
            onChangeText={setTags}
            placeholder="vip, wholesale, frequent"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.inputLabel}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add private notes about this customer..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="content-save" size={16} color="#fff" />
                <Text style={styles.saveBtnText}>Save</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* ── Order History ───────────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Order History ({customer.orders?.length || 0})</Text>
          {customer.orders && customer.orders.length > 0 ? (
            customer.orders.map((order) => (
              <View key={order.id} style={styles.orderRow}>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderNumber}>{order.order_number}</Text>
                  <Text style={styles.orderDate}>
                    {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.orderRight}>
                  <Text style={styles.orderTotal}>{order.total} UGX</Text>
                  <Text style={styles.orderStatus}>{order.status}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No orders yet.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  scrollContent: { padding: Spacing.three },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: c.surface, borderRadius: 12, padding: Spacing.three,
    borderWidth: 1, borderColor: c.border, marginBottom: Spacing.two,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: Brand.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  profileInfo: { flex: 1 },
  name: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 2 },
  email: { fontSize: 13, color: c.textSecondary, marginBottom: 6 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.two },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: c.surface, borderRadius: 10,
    padding: Spacing.two, borderWidth: 1, borderColor: c.border,
  },
  statValue: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 2 },
  statLabel: { fontSize: 11, color: c.textSecondary },
  sectionCard: {
    backgroundColor: c.surface, borderRadius: 12, padding: Spacing.three,
    borderWidth: 1, borderColor: c.border, marginBottom: Spacing.two,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 12 },
  inputLabel: { fontSize: 12, color: c.textSecondary, marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: c.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: c.text,
  },
  textArea: { minHeight: 80 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Brand.primary, paddingVertical: 10, borderRadius: 8, marginTop: 12,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  orderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.borderLight,
  },
  orderInfo: { flex: 1 },
  orderNumber: { fontSize: 14, fontWeight: '600', color: c.text },
  orderDate: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  orderRight: { alignItems: 'flex-end' },
  orderTotal: { fontSize: 13, fontWeight: '700', color: Brand.primary },
  orderStatus: { fontSize: 11, color: c.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  emptyText: { fontSize: 13, color: c.textTertiary, textAlign: 'center', paddingVertical: 16 },
  errorText: { fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: Brand.primary, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
});
