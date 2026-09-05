import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import { ScrollToTopButton } from '@/components/scroll-to-top';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { fetchCategories } from '@/services/catalog';
import type { Category } from '@/types';

export default function CategoriesScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const leftListRef = useRef<FlatList>(null);
  const rightScrollRef = useRef<ScrollView>(null);

  // Filter categories by search query
  const filteredCategories = searchQuery.trim()
    ? categories.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.children || []).some((ch) => ch.name.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    : categories;

  const load = useCallback(async () => {
    try {
      const cats = await fetchCategories();
      setCategories(cats);
      if (cats.length > 0 && !selectedSlug) {
        setSelectedSlug(cats[0].slug);
      }
    } catch (e: any) {
      console.error('Categories load error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedCategory = filteredCategories.find((c) => c.slug === selectedSlug) || null;

  const handleCategoryPress = (cat: Category) => {
    router.push({
      pathname: '/search',
      params: { category: cat.slug, categoryName: cat.name },
    } as any);
  };

  const handleScroll = useCallback((event: any) => {
    setShowScrollTop(event.nativeEvent.contentOffset.y > 300);
  }, []);

  const scrollToTop = useCallback(() => {
    rightScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // ── Left panel: parent categories ──────────────────────────────
  const renderParent = useCallback(
    ({ item }: { item: Category }) => {
      const active = item.slug === selectedSlug;
      return (
        <Pressable
          style={({ pressed }) => [styles.parentItem, active && styles.parentItemActive, pressed && { opacity: 0.85 }]}
          onPress={() => setSelectedSlug(item.slug)}
        >
          {active && <View style={styles.activeBar} />}
          <View style={styles.parentCircle}>
            {item.display_image ? (
              <Image source={{ uri: item.display_image }} style={styles.parentCircleImg} contentFit="cover" transition={150} />
            ) : (
              <View style={styles.parentCircleFallback}>
                <MaterialCommunityIcons name="tag" size={18} color="#FFFFFF" />
              </View>
            )}
          </View>
          <Text
            style={[styles.parentName, active && styles.parentNameActive]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
        </Pressable>
      );
    },
    [selectedSlug]
  );

  // ── Right panel: subcategory card ──────────────────────────────
  const renderSubCard = useCallback(
    (cat: Category) => (
      <Pressable
        key={`sub-${cat.id}-${cat.slug}`}
        style={({ pressed }) => [styles.subCard, pressed && { opacity: 0.85 }]}
        onPress={() => handleCategoryPress(cat)}
      >
        <View style={styles.subCircle}>
          {cat.display_image ? (
            <Image source={{ uri: cat.display_image }} style={styles.subCircleImg} contentFit="cover" transition={150} />
          ) : (
            <View style={styles.subCircleFallback}>
              <MaterialCommunityIcons name="tag" size={22} color="#FFFFFF" />
            </View>
          )}
        </View>
        <Text style={styles.subName} numberOfLines={2}>{cat.name}</Text>
      </Pressable>
    ),
    [router]
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Categories</Text>
            <Text style={styles.headerSub}>Browse all product categories</Text>
          </View>
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading categories...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header with profile + search */}
        <View style={styles.header}>
          {/* Title row with profile on the right */}
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.headerTitle}>Categories</Text>
              <Text style={styles.headerSub}>Browse all product categories</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.profileBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/buyer' as any)}
            >
              {isAuthenticated && user ? (
                <View style={styles.avatarWrap}>
                  {user.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitial}>
                        {(user.first_name || user.email || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.avatarFallback}>
                  <MaterialCommunityIcons name="account" size={20} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
          </View>
          {/* Search bar */}
          <View style={styles.searchBar}>
            <MaterialCommunityIcons name="magnify" size={20} color="rgba(255,255,255,0.7)" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search categories..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle" size={18} color="rgba(255,255,255,0.7)" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Body: left menu + right content */}
        <View style={styles.body}>
          {/* Left panel — parent categories */}
          <View style={styles.leftPanel}>
            <FlatList
              data={filteredCategories}
              keyExtractor={(item, index) => `parent-${item.id}-${item.slug}-${index}`}
              renderItem={renderParent}
              contentContainerStyle={styles.parentList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); load(); }}
                  colors={[Brand.primary]}
                  tintColor={Brand.primary}
                />
              }
            />
          </View>

          {/* Right panel — children of selected category */}
          <ScrollView
            ref={rightScrollRef}
            style={styles.rightPanel}
            contentContainerStyle={styles.rightContent}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {/* Selected category header */}
            {selectedCategory && (
              <Pressable
                style={({ pressed }) => [styles.selectedHeader, pressed && { opacity: 0.85 }]}
                onPress={() => handleCategoryPress(selectedCategory)}
              >
                <View style={styles.selectedHeaderCircle}>
                  {selectedCategory.display_image ? (
                    <Image source={{ uri: selectedCategory.display_image }} style={styles.selectedHeaderImg} contentFit="cover" transition={150} />
                  ) : (
                    <View style={styles.selectedHeaderFallback}>
                      <MaterialCommunityIcons name="tag" size={28} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View style={styles.selectedHeaderInfo}>
                  <Text style={styles.selectedHeaderName}>{selectedCategory.name}</Text>
                  <Text style={styles.selectedHeaderHint}>Tap to browse all</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={Brand.textTertiary} />
              </Pressable>
            )}

            {/* Subcategories grid */}
            {selectedCategory?.children && selectedCategory.children.length > 0 ? (
              <>
                <Text style={styles.subSectionTitle}>Subcategories</Text>
                <View style={styles.subGrid}>
                  {selectedCategory.children.map((child) => renderSubCard(child))}
                </View>
              </>
            ) : (
              <View style={styles.emptySubs}>
                <MaterialCommunityIcons name="package-variant-closed" size={40} color={Brand.textTertiary} />
                <Text style={styles.emptySubsText}>No subcategories yet</Text>
                {selectedCategory && (
                  <Pressable
                    style={({ pressed }) => [styles.browseBtn, pressed && { opacity: 0.85 }]}
                    onPress={() => handleCategoryPress(selectedCategory)}
                  >
                    <Text style={styles.browseBtnText}>Browse {selectedCategory.name}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </ScrollView>
        </View>
        <ScrollToTopButton visible={showScrollTop} onPress={scrollToTop} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Brand.primary,
  },
  // Title row with profile on the right
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  profileBtn: {
    padding: 2,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    padding: 0,
  },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  loadingText: { marginTop: 8, color: Brand.primary, fontSize: 14 },

  // ── Body split layout ──────────────────────────────────────────
  body: { flex: 1, flexDirection: 'row' },

  // ── Left panel ─────────────────────────────────────────────────
  leftPanel: {
    width: 100,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: Brand.surfaceAlt,
  },
  parentList: { paddingVertical: 4, paddingHorizontal: 4 },
  parentItem: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    width: '100%',
  },
  parentItemActive: {
    backgroundColor: Brand.surfaceAlt,
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 3,
    backgroundColor: Brand.primary,
  },
  parentCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Brand.border,
  },
  parentCircleImg: { width: '100%', height: '100%' },
  parentCircleFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  parentName: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: '600',
    color: Brand.textSecondary,
    textAlign: 'center',
    lineHeight: 13,
  },
  parentNameActive: {
    color: Brand.primary,
    fontWeight: '800',
  },

  // ── Right panel ────────────────────────────────────────────────
  rightPanel: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderLeftWidth: 1,
    borderLeftColor: Brand.surfaceAlt,
  },
  rightContent: { padding: 12, paddingBottom: 24 },

  // Selected category header card
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  selectedHeaderCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Brand.surfaceAlt,
  },
  selectedHeaderImg: { width: '100%', height: '100%' },
  selectedHeaderFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedHeaderInfo: { flex: 1, gap: 2 },
  selectedHeaderName: { fontSize: 16, fontWeight: '800', color: Brand.text },
  selectedHeaderHint: { fontSize: 12, color: Brand.textTertiary },

  // Subcategory grid
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.textSecondary,
    marginBottom: 12,
  },
  subGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  subCard: {
    width: 76,
    alignItems: 'center',
  },
  subCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Brand.surfaceAlt,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  subCircleImg: { width: '100%', height: '100%' },
  subCircleFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subName: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: Brand.textSecondary,
    textAlign: 'center',
    lineHeight: 13,
  },

  // Empty state
  emptySubs: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptySubsText: { fontSize: 14, color: Brand.textTertiary },
  browseBtn: {
    marginTop: 8,
    backgroundColor: Brand.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  browseBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
