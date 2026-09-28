import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { GradientHeader } from '@/components/GradientHeader';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { fetchMySellers } from '@/services/connection';
import type { FollowedStore } from '@/types';

export default function MySellersScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const renderItem = ({ item }: { item: FollowedStore }) => {
    const meta = [
      item.rating > 0 ? `${item.rating.toFixed(1)}` : null,
      `${item.product_count} products`,
      `${item.follower_count} followers`,
    ].filter(Boolean);
    return (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
        onPress={() => router.push(`/store/${item.slug}` as any)}
      >
        {item.logo_url ? (
          <Image source={{ uri: item.logo_url }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoPlaceholderText}>{item.name.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.storeName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.metaRow}>
            {item.rating > 0 && (
              <MaterialCommunityIcons name="star" size={11} color={Brand.rating} />
            )}
            <Text style={styles.metaText} numberOfLines={1}>{meta.join(' · ')}</Text>
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textTertiary} />
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="My Sellers"
        subtitle={!loading && stores.length > 0 ? `${stores.length} store${stores.length === 1 ? '' : 's'} followed` : undefined}
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
      ) : stores.length === 0 ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="store-off" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No sellers followed yet</Text>
          <Text style={styles.emptySubtitle}>Follow sellers to stay updated on their products</Text>
          <Pressable style={styles.shopBtn} onPress={() => router.push('/suppliers' as any)}>
            <Text style={styles.shopBtnText}>Browse Suppliers</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={stores}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          style={styles.listCard}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Brand.primary]} tintColor={Brand.primary} />}
        />
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  listCard: { flex: 1 },
  list: {
    margin: 10, borderRadius: 14, overflow: 'hidden',
    backgroundColor: c.surface,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 10, paddingVertical: 9,
  },
  logo: { width: 40, height: 40, borderRadius: 10 },
  logoPlaceholder: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: Brand.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  logoPlaceholderText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  info: { flex: 1, gap: 2 },
  storeName: { fontSize: 13, fontWeight: '700', color: c.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: c.textTertiary, fontWeight: '500', flexShrink: 1 },
  rowDivider: { height: 1, backgroundColor: c.borderLight, marginLeft: 60 },
  errorText: { fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 9, backgroundColor: Brand.primary, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginTop: 10 },
  emptySubtitle: { fontSize: 13, color: c.textSecondary, marginTop: 3, textAlign: 'center' },
  shopBtn: { marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 10 },
  shopBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
