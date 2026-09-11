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
import { getLedger, type LedgerAccount } from '@/services/financial';

export default function AdminLedgerScreen() {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const result = await getLedger();
      setAccounts(result.accounts || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (v: string | number | undefined | null) => Number(v || 0).toLocaleString();

  if (loading && accounts.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Financial Ledger" subtitle="Double-entry accounting" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (error && accounts.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Financial Ledger" subtitle="Double-entry accounting" />
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
      <ModernHeader title="Financial Ledger" subtitle="Double-entry accounting" />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
      >
        <View style={styles.body}>
          {accounts.length === 0 ? (
            <View style={styles.centerBody}>
              <MaterialCommunityIcons name="book-open" size={48} color={Brand.textTertiary} />
              <Text style={styles.emptyText}>No ledger accounts</Text>
            </View>
          ) : (
            accounts.map((account) => (
              <View key={account.code} style={styles.accountCard}>
                <View style={styles.accountHeader}>
                  <View style={styles.accountInfo}>
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeText}>{account.code}</Text>
                    </View>
                    <Text style={styles.accountName}>{account.name}</Text>
                    <Text style={styles.accountType}>{account.account_type}</Text>
                  </View>
                  <Text style={[styles.accountBalance, { color: account.account_type === 'asset' || account.account_type === 'expense' ? Brand.danger : Brand.success }]}>
                    UGX {fmt(account.balance)}
                  </Text>
                </View>

                {account.recent_entries && account.recent_entries.length > 0 ? (
                  account.recent_entries.slice(0, 5).map((entry) => (
                    <View key={`e-${entry.id}`} style={styles.entryRow}>
                      <View style={[styles.entryTypeBadge, { backgroundColor: entry.entry_type === 'debit' ? '#DC262620' : '#16A34A20' }]}>
                        <Text style={[styles.entryTypeText, { color: entry.entry_type === 'debit' ? Brand.danger : Brand.success }]}>
                          {entry.entry_type}
                        </Text>
                      </View>
                      <View style={styles.entryInfo}>
                        <Text style={styles.entryDesc} numberOfLines={1}>{entry.description || '—'}</Text>
                        <Text style={styles.entryRef}>{entry.reference_type}:{entry.reference_id}</Text>
                      </View>
                      <Text style={[styles.entryAmount, { color: entry.entry_type === 'debit' ? Brand.danger : Brand.success }]}>
                        {entry.entry_type === 'debit' ? '-' : '+'}UGX {fmt(entry.amount)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noEntries}>No entries</Text>
                )}
              </View>
            ))
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

  accountCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  accountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  accountInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  codeText: { fontSize: 11, fontFamily: 'monospace', color: Brand.text },
  accountName: { fontSize: 15, fontWeight: '700', color: Brand.text },
  accountType: { fontSize: 10, color: Brand.textTertiary, textTransform: 'uppercase' },
  accountBalance: { fontSize: 16, fontWeight: '800' },

  entryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Brand.borderLight,
  },
  entryTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  entryTypeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  entryInfo: { flex: 1, gap: 2 },
  entryDesc: { fontSize: 12, fontWeight: '600', color: Brand.text },
  entryRef: { fontSize: 10, color: Brand.textTertiary, fontFamily: 'monospace' },
  entryAmount: { fontSize: 13, fontWeight: '800' },

  noEntries: { fontSize: 12, color: Brand.textTertiary, fontStyle: 'italic', paddingVertical: 8 },
});
