import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { getAuditLog, type AuditLog } from '@/services/financial';

export default function AdminAuditLogScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const result = await getAuditLog();
      setLogs(result.logs || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: AuditLog }) => (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <View style={styles.logIcon}>
          <MaterialCommunityIcons name="clipboard-list-outline" size={18} color={Brand.primary} />
        </View>
        <View style={styles.logInfo}>
          <Text style={styles.logAction}>{item.action.replace('_', ' ').toUpperCase()}</Text>
          <Text style={styles.logUser}>by {item.performed_by || 'System'}</Text>
        </View>
        <Text style={styles.logDate}>{new Date(item.timestamp).toLocaleDateString()}</Text>
      </View>

      <View style={styles.logDetails}>
        <View style={styles.logRefRow}>
          <Text style={styles.logRefLabel}>Reference:</Text>
          <Text style={styles.logRefValue}>{item.reference_type}:{item.reference_id}</Text>
        </View>
        {item.reason ? (
          <Text style={styles.logReason}>Reason: {item.reason}</Text>
        ) : null}
      </View>
    </View>
  );

  if (loading && logs.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Audit Log" subtitle="Immutable financial action records" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (error && logs.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Audit Log" subtitle="Immutable financial action records" />
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
      <ModernHeader title="Audit Log" subtitle="Immutable financial action records" />
      <FlatList
        data={logs}
        keyExtractor={(item) => `${item.id}`}
        renderItem={renderItem}
        maxToRenderPerBatch={10}
        windowSize={11}
        initialNumToRender={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="clipboard-list-outline" size={48} color={Brand.textTertiary} />
            <Text style={styles.emptyText}>No audit logs found</Text>
          </View>
        }
      />
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

  list: { padding: 12, paddingBottom: 32 },

  logCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 8,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  logHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  logIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#DCF5EC', justifyContent: 'center', alignItems: 'center' },
  logInfo: { flex: 1, gap: 2 },
  logAction: { fontSize: 13, fontWeight: '700', color: Brand.text },
  logUser: { fontSize: 11, color: Brand.textTertiary },
  logDate: { fontSize: 11, color: Brand.textTertiary },

  logDetails: { backgroundColor: Brand.surfaceAlt, borderRadius: 8, padding: 10 },
  logRefRow: { flexDirection: 'row', gap: 6 },
  logRefLabel: { fontSize: 11, color: Brand.textSecondary, fontWeight: '600' },
  logRefValue: { fontSize: 11, color: Brand.text, fontFamily: 'monospace' },
  logReason: { fontSize: 11, color: Brand.textSecondary, marginTop: 4, fontStyle: 'italic' },
});
