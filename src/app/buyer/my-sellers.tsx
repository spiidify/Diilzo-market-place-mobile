import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { fetchMySellers } from '@/services/connection';
import type { FollowedStore } from '@/types';

export default function MySellersScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [stores, setStores] = useState<FollowedStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await fetchMySellers();
      setStores(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load sellers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = ({ item }: { item: FollowedStore }) => (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/store/${item.slug}` as any)}
    >
      <View style={styles.cardHeader}>
        {item.logo_url ? (
          <Image source={{ uri: item.logo_url }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoPlaceholderText}>{item.name.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.storeName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.metaRow}>
            {item.rating > 0 && (
              <Text style={styles.metaText}>
                <MaterialCommunityIcons name="star" size={12} color="#FFB800" /> {item.rating.toFixed(1)}
              </Text>
            )}
            <Text style={styles.metaText}>{item.product_count} products</Text>
            <Text style={styles.metaText}>{item.follower_count} followers</Text>
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={Brand.textTertiary} />
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Brand.text} />
          </Pressable>
          <Text style={styles.headerTitle}>My Sellers</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Brand.text} />
        </Pressable>
        <Text style={styles.headerTitle}>My Sellers</Text>
        <View style={{ width: 24 }} />
      </View>
      {error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : stores.length === 0 ? (
        <View style={styles.centerContent}>
          <MaterialCommunityIcons name="store-off" size={48} color={Brand.textTertiary} />
          <Text style={styles.emptyTitle}>No sellers followed yet</Text>
          <Text style={styles.emptySubtitle}>Follow sellers to stay updated on their products</Text>
        </View>
      ) : (
        <FlatList
          data={stores}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    borderBottomWidth: 1, borderBottomColor: Brand.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Brand.text },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  list: { padding: Spacing.three },
  card: {
    backgroundColor: Brand.surface, borderRadius: 12, padding: Spacing.three,
    marginBottom: Spacing.two, borderWidth: 1, borderColor: Brand.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 8 },
  logoPlaceholder: {
    width: 48, height: 48, borderRadius: 8, backgroundColor: Brand.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  logoPlaceholderText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardInfo: { flex: 1 },
  storeName: { fontSize: 16, fontWeight: '600', color: Brand.text, marginBottom: 4 },
  metaRow: { flexDirection: 'row', gap: 8 },
  metaText: { fontSize: 12, color: Brand.textSecondary },
  errorText: { fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: Brand.primary, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Brand.text, marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: Brand.textSecondary, marginTop: 4, textAlign: 'center' },
});
