import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { getAdminDashboard, getSidebarCounts, type AdminDashboard, type SidebarCounts } from '@/services/adminApi';

interface MenuItem {
  icon: string;
  label: string;
  route: string;
  color: string;
  badgeKey?: keyof SidebarCounts;
}

const MENU_SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { icon: 'chart-line', label: 'Dashboard', route: '/admin', color: '#3B82F6' },
      { icon: 'percent', label: 'Commission Report', route: '/admin/commission-report', color: '#8B5CF6' },
    ],
  },
  {
    title: 'Marketplace',
    items: [
      { icon: 'account-group', label: 'Users', route: '/admin/users', color: '#06B6D4', badgeKey: undefined },
      { icon: 'store', label: 'Stores', route: '/admin/stores', color: '#16A34A', badgeKey: 'pending_stores' },
      { icon: 'package-variant-closed', label: 'Products', route: '/admin/products', color: '#3B82F6' },
      { icon: 'clipboard-list', label: 'Orders', route: '/admin/orders', color: '#F59E0B' },
    ],
  },
  {
    title: 'Financials',
    items: [
      { icon: 'wallet', label: 'Payouts', route: '/admin/payouts', color: '#8B5CF6', badgeKey: 'pending_payouts' },
      { icon: 'alert-circle', label: 'Disputes', route: '/admin/disputes', color: Brand.danger, badgeKey: 'active_disputes' },
      { icon: 'shield-lock', label: 'Escrow', route: '/admin/escrow', color: '#EC4899', badgeKey: 'held_escrow' },
    ],
  },
  {
    title: 'Verification',
    items: [
      { icon: 'shield-check', label: 'KYC Review', route: '/admin/kyc', color: '#06B6D4', badgeKey: 'pending_kyc' },
      { icon: 'account-check', label: 'Suppliers', route: '/admin/suppliers', color: '#16A34A', badgeKey: 'pending_verification' },
      { icon: 'history', label: 'Verification Logs', route: '/admin/verification-logs', color: Brand.textSecondary },
    ],
  },
  {
    title: 'Logistics',
    items: [
      { icon: 'truck-fast', label: 'Shipments', route: '/admin/shipments', color: '#3B82F6', badgeKey: 'pending_shipments' },
      { icon: 'warehouse', label: 'Warehouses', route: '/admin/warehouses', color: '#F97316' },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { icon: 'shape', label: 'Categories', route: '/admin/categories', color: '#3B82F6' },
      { icon: 'tag-multiple', label: 'Brands', route: '/admin/brands', color: '#EC4899' },
      { icon: 'percent-circle', label: 'Tax Rates', route: '/admin/tax', color: '#F59E0B' },
      { icon: 'chart-percent', label: 'Commission Config', route: '/admin/commission-config', color: '#8B5CF6' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { icon: 'cog', label: 'Settings', route: '/admin/settings', color: Brand.textSecondary },
      { icon: 'bullhorn', label: 'Announcements', route: '/admin/announcements', color: '#06B6D4' },
      { icon: 'image-multiple', label: 'Slides', route: '/admin/slides', color: '#EC4899' },
      { icon: 'credit-card', label: 'Subscriptions', route: '/admin/subscriptions', color: '#3B82F6' },
      { icon: 'crown', label: 'Memberships', route: '/admin/memberships', color: '#F59E0B' },
      { icon: 'currency-usd', label: 'Currencies', route: '/admin/currencies', color: '#16A34A' },
      { icon: 'barcode', label: 'HS Codes', route: '/admin/hs-codes', color: '#8B5CF6' },
      { icon: 'block-helper', label: 'Restricted Goods', route: '/admin/restricted-goods', color: Brand.danger },
      { icon: 'chart-line', label: 'Revenue Report', route: '/admin/revenue-report', color: '#16A34A' },
      { icon: 'scale-balance', label: 'Reconciliation', route: '/admin/reconciliation', color: '#F59E0B' },
      { icon: 'book-open', label: 'Ledger', route: '/admin/ledger', color: '#8B5CF6' },
      { icon: 'file-export', label: 'Accounting Export', route: '/admin/accounting-export', color: '#06B6D4' },
      { icon: 'clipboard-list', label: 'Audit Log', route: '/admin/audit-log', color: Brand.textSecondary },
    ],
  },
];

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [counts, setCounts] = useState<SidebarCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const [d, c] = await Promise.all([getAdminDashboard(), getSidebarCounts()]);
      setDashboard(d);
      setCounts(c);
    } catch (e: any) {
      console.error('Admin dashboard error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpiCards = [
    { icon: 'currency-usd', label: 'GMV (30d)', value: dashboard ? `UGX ${Number(dashboard.total_gmv).toLocaleString()}` : '—', color: '#3B82F6' },
    { icon: 'percent', label: 'Commission', value: dashboard ? `UGX ${Number(dashboard.total_commission).toLocaleString()}` : '—', color: '#8B5CF6' },
    { icon: 'store', label: 'Active Stores', value: dashboard?.active_stores ?? '—', color: '#16A34A' },
    { icon: 'account-group', label: 'Total Users', value: dashboard?.total_users ?? '—', color: '#06B6D4' },
    { icon: 'clipboard-list', label: 'Total Orders', value: dashboard?.total_orders ?? '—', color: '#F59E0B' },
    { icon: 'package-variant', label: 'Products', value: dashboard?.total_products ?? '—', color: '#EC4899' },
  ];

  const renderSection = ({ item: section }: { item: typeof MENU_SECTIONS[0] }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <View style={styles.menuGrid}>
        {section.items.map((menuItem, idx) => {
          const badge = menuItem.badgeKey && counts ? counts[menuItem.badgeKey] : 0;
          return (
            <Pressable
              key={`${section.title}-${idx}`}
              style={({ pressed }) => [styles.menuCard, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(menuItem.route as any)}
            >
              <View style={[styles.menuIcon, { backgroundColor: menuItem.color + '15' }]}>
                <MaterialCommunityIcons name={menuItem.icon as any} size={22} color={menuItem.color} />
              </View>
              <Text style={styles.menuLabel} numberOfLines={2}>{menuItem.label}</Text>
              {badge !== undefined && badge > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ModernHeader title="Admin Dashboard" subtitle="Platform Management" />
      <View style={styles.body}>
        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={MENU_SECTIONS}
            keyExtractor={(item) => item.title}
            renderItem={renderSection}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListHeaderComponent={
              <View style={styles.kpiSection}>
                <Text style={styles.sectionTitle}>Key Metrics</Text>
                <View style={styles.kpiGrid}>
                  {kpiCards.map((card, idx) => (
                    <View key={`kpi-${idx}`} style={styles.kpiCard}>
                      <View style={[styles.kpiIcon, { backgroundColor: card.color + '15' }]}>
                        <MaterialCommunityIcons name={card.icon as any} size={20} color={card.color} />
                      </View>
                      <Text style={styles.kpiValue} numberOfLines={1}>{card.value}</Text>
                      <Text style={styles.kpiLabel}>{card.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  body: { flex: 1 },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12, paddingBottom: 40 },
  kpiSection: { marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: Brand.textSecondary, marginBottom: 10, paddingHorizontal: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { flex: 1, minWidth: '31%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, gap: 6, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  kpiIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  kpiValue: { fontSize: 16, fontWeight: '800', color: Brand.text },
  kpiLabel: { fontSize: 11, color: Brand.textTertiary },
  section: { marginBottom: 16 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  menuCard: { flex: 1, minWidth: '31%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, alignItems: 'center', gap: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  menuIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { fontSize: 12, fontWeight: '600', color: Brand.text, textAlign: 'center' },
  badge: { position: 'absolute', top: 8, right: 8, backgroundColor: Brand.danger, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
});
