import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { getAccountingExport, type AccountingExport } from '@/services/financial';

export default function AdminAccountingExportScreen() {
  const [exportData, setExportData] = useState<AccountingExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const result = await getAccountingExport();
      setExportData(result);
    } catch (e: any) {
      setError(e?.message || 'Failed to load accounting export');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (v: string | number | undefined | null) => Number(v || 0).toLocaleString();

  if (loading && !exportData) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Accounting Export" subtitle="Export ledger for accounting software" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (error && !exportData) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Accounting Export" subtitle="Export ledger for accounting software" />
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

  const accounts = exportData?.accounts || {};
  const accountKeys = Object.keys(accounts);

  return (
    <View style={styles.screen}>
      <ModernHeader title="Accounting Export" subtitle="Export ledger for accounting software" />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
      >
        <View style={styles.body}>
          {/* Summary KPIs */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: '#3B82F6' }]}>
              <MaterialCommunityIcons name="file-document" size={22} color="#FFFFFF" />
              <Text style={styles.kpiLabel}>Entries</Text>
              <Text style={styles.kpiValue}>{exportData?.total_entries || 0}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: Brand.danger }]}>
              <MaterialCommunityIcons name="arrow-down" size={22} color="#FFFFFF" />
              <Text style={styles.kpiLabel}>Debits</Text>
              <Text style={styles.kpiValue}>UGX {fmt(exportData?.total_debits)}</Text>
            </View>
          </View>
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: Brand.success }]}>
              <MaterialCommunityIcons name="arrow-up" size={22} color="#FFFFFF" />
              <Text style={styles.kpiLabel}>Credits</Text>
              <Text style={styles.kpiValue}>UGX {fmt(exportData?.total_credits)}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: exportData?.is_balanced ? Brand.success : Brand.danger }]}>
              <MaterialCommunityIcons name="scale-balance" size={22} color="#FFFFFF" />
              <Text style={styles.kpiLabel}>Status</Text>
              <Text style={styles.kpiValue}>{exportData?.is_balanced ? 'BALANCED' : 'UNBAL'}</Text>
            </View>
          </View>

          {/* Period info */}
          <View style={styles.periodCard}>
            <MaterialCommunityIcons name="calendar-clock" size={18} color={Brand.textSecondary} />
            <Text style={styles.periodText}>
              Period: {exportData?.start_date?.slice(0, 10)} — {exportData?.end_date?.slice(0, 10)}
            </Text>
          </View>

          {/* Accounts */}
          {accountKeys.length === 0 ? (
            <View style={styles.centerBody}>
              <MaterialCommunityIcons name="file-export" size={48} color={Brand.textTertiary} />
              <Text style={styles.emptyText}>No entries in this period</Text>
            </View>
          ) : (
            accountKeys.map((code) => {
              const account = (accounts as any)[code];
              return (
                <View key={code} style={styles.accountCard}>
                  <View style={styles.accountHeader}>
                    <View style={styles.accountInfo}>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeText}>{code}</Text>
                      </View>
                      <Text style={styles.accountName}>{account.name}</Text>
                    </View>
                    <Text style={styles.accountTotals}>
                      D: UGX {fmt(account.total_debits)} · C: UGX {fmt(account.total_credits)}
                    </Text>
                  </View>

                  {account.entries && account.entries.length > 0 ? (
                account.entries.slice(0, 10).map((entry: any, i: number) => (
                  <View key={`e-${i}`} style={styles.entryRow}>
                    <Text style={[styles.entryType, { color: entry.entry_type === 'debit' ? Brand.danger : Brand.success }]}>
                      {entry.entry_type}
                    </Text>
                    <View style={styles.entryInfo}>
                      <Text style={styles.entryDesc} numberOfLines={1}>{entry.description || '—'}</Text>
                      <Text style={styles.entryRef}>{entry.reference_type}:{entry.reference_id}</Text>
                    </View>
                    <Text style={[styles.entryAmount, { color: entry.entry_type === 'debit' ? Brand.danger : Brand.success }]}>
                      UGX {fmt(entry.amount)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noEntries}>No entries</Text>
              )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  emptyText: { marginTop: 12, fontSize: 14, color: Brand.textSecondary },

  body: { padding: 12, paddingBottom: 32 },

  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiCard: {
    flex: 1, borderRadius: 16, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  kpiLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 6 },
  kpiValue: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },

  periodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 12,
  },
  periodText: { fontSize: 13, color: Brand.textSecondary, fontWeight: '600' },

  accountCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  accountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  accountInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  codeBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  codeText: { fontSize: 11, fontFamily: 'monospace', color: Brand.text },
  accountName: { fontSize: 14, fontWeight: '700', color: Brand.text },
  accountTotals: { fontSize: 11, color: Brand.textSecondary },

  entryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Brand.borderLight,
  },
  entryType: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize', width: 50 },
  entryInfo: { flex: 1, gap: 2 },
  entryDesc: { fontSize: 12, fontWeight: '600', color: Brand.text },
  entryRef: { fontSize: 10, color: Brand.textTertiary, fontFamily: 'monospace' },
  entryAmount: { fontSize: 13, fontWeight: '800' },

  noEntries: { fontSize: 12, color: Brand.textTertiary, fontStyle: 'italic', paddingVertical: 8 },
});
