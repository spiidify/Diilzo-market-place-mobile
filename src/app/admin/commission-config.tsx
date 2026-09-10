import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import {
  commissionConfigAction,
  getCommissionConfig,
  type AdminCommissionConfig,
} from '@/services/adminApi';

export default function AdminCommissionConfigScreen() {
  const router = useRouter();
  const [configs, setConfigs] = useState<AdminCommissionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getCommissionConfig();
      setConfigs(data);
    } catch (e: any) {
      console.error('Admin commission config error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = (config: AdminCommissionConfig) => {
    Alert.alert(
      'Toggle Commission',
      `${config.is_active ? 'Deactivate' : 'Activate'} commission for "${config.category_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await commissionConfigAction({ action: 'toggle', id: config.id });
              Alert.alert('Success', 'Commission config updated');
              load();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || 'Failed to update');
            }
          },
        },
      ],
    );
  };

  const handleDelete = (config: AdminCommissionConfig) => {
    Alert.alert(
      'Delete Commission Config',
      `Are you sure you want to delete the commission config for "${config.category_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await commissionConfigAction({ action: 'delete', id: config.id });
              Alert.alert('Success', 'Commission config deleted');
              load();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || 'Failed to delete');
            }
          },
        },
      ],
    );
  };

  const showActions = (config: AdminCommissionConfig) => {
    Alert.alert(config.category_name, 'Choose an action', [
      { text: 'Cancel', style: 'cancel' },
      { text: config.is_active ? 'Deactivate' : 'Activate', onPress: () => handleToggle(config) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(config) },
    ]);
  };

  const renderItem = ({ item }: { item: AdminCommissionConfig }) => (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => showActions(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.catName} numberOfLines={1}>{item.category_name}</Text>
        <View style={[styles.badge, { backgroundColor: (item.is_active ? Brand.primary : Brand.textTertiary) + '20' }]}>
          <Text style={[styles.badgeText, { color: item.is_active ? Brand.primary : Brand.textTertiary }]}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      <Text style={styles.rateText}>{item.commission_rate}% commission</Text>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.dark, Brand.darkLight, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Commission Config</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={configs}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="percent-circle-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No commission configs</Text>
                <Text style={styles.emptySub}>No commission configurations set up</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.dark },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  catName: { fontSize: 15, fontWeight: '800', color: Brand.text, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  rateText: { fontSize: 14, fontWeight: '700', color: Brand.accent },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
});
