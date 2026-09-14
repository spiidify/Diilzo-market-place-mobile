import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useBadges } from '@/context/BadgeContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { createSupportChat, fetchChatThreads } from '@/services/chat';
import type { ChatThread } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────
function formatChatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getLastMessagePreview(thread: ChatThread, isBuyer: boolean = true): string {
  const last = thread.last_message;
  if (!last) return 'Tap to start chatting';
  if (last.message_type === 'audio') return '🎤 Voice message';
  // "You" is the buyer when the current user is the buyer, otherwise it's the seller
  const senderIsBuyer = last.sender === thread.buyer_name;
  const sender = (isBuyer ? senderIsBuyer : !senderIsBuyer) ? 'You' : last.sender;
  const text = last.message || '';
  return `${sender}: ${text}`;
}

export default function ChatListScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { refreshBadges } = useBadges();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingSupport, setStartingSupport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      setRefreshing(true);
      setError(null);
      const data = await fetchChatThreads();
      setThreads(data);
      // Refresh badge counts since opening the chat list may mark threads as read
      refreshBadges();
    } catch (e: any) {
      setError(e?.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, refreshBadges]);

  useEffect(() => { load(); }, [load]);

  // Refresh when screen gains focus (coming back from a chat)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSupportChat = async () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login' as any);
      return;
    }
    try {
      setStartingSupport(true);
      const thread = await createSupportChat();
      router.push(`/chat/${thread.id}` as any);
    } catch (e: any) {
      console.error('Support chat error:', e?.message);
    } finally {
      setStartingSupport(false);
    }
  };

  // Filter threads by search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter(t => {
      const name = t.is_support ? 'diilzo support' : (t.store_name || '').toLowerCase();
      const product = (t.product_name || '').toLowerCase();
      const lastMsg = t.last_message?.message?.toLowerCase() || '';
      return name.includes(q) || product.includes(q) || lastMsg.includes(q);
    });
  }, [threads, searchQuery]);

  // Sort: unread first, then by last message time
  const sortedThreads = useMemo(() => {
    return [...filteredThreads].sort((a, b) => {
      if ((b.unread_count || 0) !== (a.unread_count || 0)) {
        return (b.unread_count || 0) - (a.unread_count || 0);
      }
      const aTime = a.last_message?.created_at || a.updated_at;
      const bTime = b.last_message?.created_at || b.updated_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [filteredThreads]);

  const totalUnread = useMemo(() => {
    return threads.reduce((sum, t) => sum + (t.unread_count || 0), 0);
  }, [threads]);

  const renderItem = ({ item }: { item: ChatThread }) => {
    const lastMsg = item.last_message;
    const time = lastMsg ? formatChatTime(lastMsg.created_at) : '';
    const isSupport = item.is_support;
    // Buyer sees the store name; seller sees the buyer name
    const isBuyer = item.buyer === user?.id;
    const displayName = isSupport
      ? 'Diilzo Support'
      : (isBuyer ? (item.store_name || 'Unknown Store') : (item.buyer_name || 'Unknown Buyer'));
    const preview = getLastMessagePreview(item, isBuyer);
    const isMine = isBuyer ? (lastMsg?.sender === item.buyer_name) : (lastMsg?.sender !== item.buyer_name);

    return (
      <Pressable
        style={({ pressed }) => [styles.card, isSupport && styles.supportCard, pressed && { opacity: 0.85 }]}
        onPress={() => router.push(`/chat/${item.id}` as any)}
      >
        <View style={styles.avatarWrap}>
          {isSupport ? (
            <View style={[styles.avatarFallback, { backgroundColor: colors.text }]}>
              <MaterialCommunityIcons name="headset" size={22} color="#FFFFFF" />
            </View>
          ) : isBuyer ? (
            item.store_logo ? (
              <Image source={{ uri: item.store_logo }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <MaterialCommunityIcons name="store" size={22} color="#FFFFFF" />
              </View>
            )
          ) : item.buyer_avatar ? (
            <Image source={{ uri: item.buyer_avatar }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={styles.avatarFallback}>
              <MaterialCommunityIcons name="account" size={22} color="#FFFFFF" />
            </View>
          )}
          {item.unread_count > 0 && <View style={styles.unreadDot} />}
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={styles.nameRow}>
              {isSupport && <MaterialCommunityIcons name="shield-check" size={14} color={Brand.primary} />}
              <Text style={styles.storeName} numberOfLines={1}>{displayName}</Text>
            </View>
            <Text style={[styles.time, item.unread_count > 0 && styles.timeUnread]}>{time}</Text>
          </View>
          {item.product_name ? (
            <View style={styles.productRow}>
              <MaterialCommunityIcons name="package-variant-closed" size={11} color={Brand.primary} />
              <Text style={styles.productName} numberOfLines={1}>{item.product_name}</Text>
            </View>
          ) : null}
          <View style={styles.lastMsgRow}>
            {isMine && lastMsg && (
              <MaterialCommunityIcons
                name={item.unread_count > 0 ? 'check' : 'check-all'}
                size={14}
                color={item.unread_count > 0 ? colors.textTertiary : Brand.primary}
                style={styles.tickIcon}
              />
            )}
            <Text
              style={[styles.lastMsg, item.unread_count > 0 && styles.lastMsgUnread]}
              numberOfLines={1}
            >
              {preview}
            </Text>
            {item.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <LinearGradient
          colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/' as any);
              }
            }}
            hitSlop={12}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Messages</Text>
            {totalUnread > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{totalUnread > 9 ? '9+' : totalUnread}</Text>
              </View>
            )}
          </View>
          <Pressable onPress={load} hitSlop={12}>
            <MaterialCommunityIcons name="refresh" size={22} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>

        {/* ── Search bar ──────────────────────────────────────────── */}
        {isAuthenticated && threads.length > 0 && (
          <View style={styles.searchWrap}>
            <MaterialCommunityIcons name="magnify" size={18} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
        )}

        {/* ── Not signed in ───────────────────────────────────────── */}
        {!isAuthenticated ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons name="message-outline" size={48} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>Sign in to view messages</Text>
            <Text style={styles.emptySubtext}>Chat with suppliers and Diilzo staff</Text>
            <Pressable style={styles.signInBtn} onPress={() => router.push('/(auth)/login' as any)}>
              <Text style={styles.signInBtnText}>Sign In</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.signInBtn} onPress={load}>
              <Text style={styles.signInBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ── Chat with Diilzo Staff banner ─────────────────── */}
            <Pressable
              style={({ pressed }) => [styles.supportBanner, pressed && { opacity: 0.85 }]}
              onPress={handleSupportChat}
              disabled={startingSupport}
            >
              <View style={styles.supportIconWrap}>
                {startingSupport ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialCommunityIcons name="headset" size={24} color="#FFFFFF" />
                )}
              </View>
              <View style={styles.supportInfo}>
                <Text style={styles.supportTitle}>Chat with Diilzo Staff</Text>
                <Text style={styles.supportSub}>Get help, ask questions, report issues</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color="rgba(255,255,255,0.5)" />
            </Pressable>

            {sortedThreads.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <MaterialCommunityIcons
                    name={searchQuery ? "magnify" : "message-off-outline"}
                    size={48}
                    color={colors.textTertiary}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery
                    ? 'Try a different search term'
                    : 'Start chatting with suppliers from their store or product pages'}
                </Text>
                {!searchQuery && (
                  <Pressable style={styles.browseBtn} onPress={() => router.push('/suppliers' as any)}>
                    <Text style={styles.browseBtnText}>Browse Suppliers</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <FlatList
                data={sortedThreads}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                maxToRenderPerBatch={10}
                windowSize={11}
                initialNumToRender={10}
                removeClippedSubviews={true}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            )}
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surface },
  safeArea: { flex: 1, backgroundColor: c.surface },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  headerBadge: {
    backgroundColor: '#FFFFFF',
    minWidth: 22, height: 22, borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  headerBadgeText: { color: Brand.primary, fontSize: 11, fontWeight: '800' },

  // ── Search ──────────────────────────────────────────────────────
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginVertical: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: c.surfaceAlt, borderRadius: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: c.text, padding: 0 },

  // ── List ────────────────────────────────────────────────────────
  list: { paddingVertical: 4 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: c.surfaceAlt, marginLeft: 76 },

  // ── Support banner ──────────────────────────────────────────────
  supportBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 12, marginTop: 8, marginBottom: 4,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, backgroundColor: c.text,
    elevation: 3, shadowColor: '#000000', shadowOpacity: 0.12,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  supportIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  supportInfo: { flex: 1, gap: 2 },
  supportTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  supportSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  // ── Chat card ───────────────────────────────────────────────────
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  supportCard: {
    backgroundColor: '#F1F5F9',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Brand.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute', top: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Brand.danger, borderWidth: 2, borderColor: '#FFFFFF',
  },
  cardBody: { flex: 1, gap: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  storeName: { flex: 1, fontSize: 15, fontWeight: '700', color: c.text },
  time: { fontSize: 11, color: c.textTertiary },
  timeUnread: { color: Brand.primary, fontWeight: '700' },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  productName: { fontSize: 12, color: Brand.primary, fontWeight: '500' },
  lastMsgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  tickIcon: { marginTop: 1 },
  lastMsg: { flex: 1, fontSize: 13, color: c.textSecondary },
  lastMsgUnread: { color: c.text, fontWeight: '500' },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: Brand.danger,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  // ── States ──────────────────────────────────────────────────────
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, color: c.textSecondary, fontSize: 14 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: c.surfaceAlt,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  emptySubtext: { marginTop: 8, fontSize: 14, color: c.textSecondary, textAlign: 'center' },
  signInBtn: {
    marginTop: 20, backgroundColor: Brand.primary,
    paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8,
  },
  signInBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  browseBtn: {
    marginTop: 20, backgroundColor: Brand.primary,
    paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8,
  },
  browseBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
