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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import {
  getAdminProducts,
  toggleProductActive,
  type AdminProduct,
} from '@/services/adminApi';

const STATUS_FILTERS = ['all', 'active', 'inactive'] as const;

export default function AdminProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q?: string, status?: string) => {
    try {
      setRefreshing(true);
      const params: { q?: string; status?: string } = {};
      if (q) params.q = q;
      if (status && status !== 'all') params.status = status;
      const data = await getAdminProducts(Object.keys(params).length ? params : undefined);
      setProducts(data);
    } catch (e: any) {
      console.error('Admin products error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimer) clearTimeout(searchTimer);
    const t = setTimeout(() => load(text, filter), 400);
    setSearchTimer(t);
  };

  const handleFilterChange = (status: string) => {
    setFilter(status);
    load(query, status);
  };

  const handleToggle = (product: AdminProduct) => {
    Alert.alert(
      'Confirm Toggle',
      `Are you sure you want to ${product.is_active ? 'deactivate' : 'activate'} "${product.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              await toggleProductActive(product.id);
              Alert.alert('Success', 'Product status updated');
              load(query, filter);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || 'Action failed');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: AdminProduct }) => (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => handleToggle(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        <View style={[styles.badge, { backgroundColor: (item.is_active ? Brand.primary : Brand.textTertiary) + '20' }]}>
          <Text style={[styles.badgeText, { color: item.is_active ? Brand.primary : Brand.textTertiary }]}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      <Text style={styles.storeName}>{item.store_name}</Text>
      <View style={styles.cardFooter}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Text style={styles.metaText}>{item.category_name || 'Uncategorized'}</Text>
          <Text style={styles.priceText}>UGX {Number(item.price).toLocaleString()}</Text>
        </View>
        <Text style={styles.stockText}>Stock: {item.stock_quantity}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.dark, Brand.darkLight, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Products</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color={Brand.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={Brand.textTertiary}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); load(undefined, filter); }} hitSlop={12}>
              <MaterialCommunityIcons name="close-circle" size={20} color={Brand.textTertiary} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
          {STATUS_FILTERS.map((f) => (
            <Pressable
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => handleFilterChange(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(query, filter)} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="package-variant-closed" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No products found</Text>
                <Text style={styles.emptySub}>Try a different search or filter</Text>
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
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  searchInput: { flex: 1, fontSize: 14, color: Brand.text, marginLeft: 8, paddingVertical: 0 },
  filterContainer: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Brand.border },
  filterTabActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  filterTextActive: { color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  productName: { fontSize: 15, fontWeight: '800', color: Brand.text, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  storeName: { fontSize: 13, color: Brand.textSecondary, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  priceText: { fontSize: 13, fontWeight: '700', color: Brand.text },
  stockText: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
});
