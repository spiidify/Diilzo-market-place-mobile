import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { createSupportChat, fetchChatThreads } from '@/services/chat';
import type { ChatThread } from '@/types';

export default function ChatListScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingSupport, setStartingSupport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      setRefreshing(true);
      setError(null);
      const data = await fetchChatThreads();
      setThreads(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { load(); }, [load]);

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

  const renderItem = ({ item }: { item: ChatThread }) => {
    const lastMsg = item.last_message;
    const time = lastMsg ? new Date(lastMsg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    const isSupport = item.is_support;
    const displayName = isSupport ? 'Diilzo Support' : (item.store_name || 'Unknown Store');
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        onPress={() => router.push(`/chat/${item.id}` as any)}
      >
        <View style={styles.avatarWrap}>
          {isSupport ? (
            <View style={[styles.avatarFallback, { backgroundColor: Brand.text }]}>
              <MaterialCommunityIcons name="headset" size={22} color="#FFFFFF" />
            </View>
          ) : item.store_logo ? (
            <Image source={{ uri: item.store_logo }} style={styles.avatar} resizeMode="contain" />
          ) : (
            <View style={styles.avatarFallback}>
              <MaterialCommunityIcons name="store" size={22} color="#FFFFFF" />
            </View>
          )}
          {item.unread_count > 0 && (
            <View style={styles.unreadDot} />
          )}
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={styles.nameRow}>
              {isSupport && <MaterialCommunityIcons name="shield-check" size={14} color={Brand.primary} />}
              <Text style={styles.storeName} numberOfLines={1}>{displayName}</Text>
            </View>
            <Text style={styles.time}>{time}</Text>
          </View>
          {item.product_name ? (
            <Text style={styles.productName} numberOfLines={1}>{item.product_name}</Text>
          ) : null}
          <View style={styles.lastMsgRow}>
            <Text style={styles.lastMsg} numberOfLines={1}>
              {lastMsg ? `${lastMsg.sender === item.buyer_name ? 'You' : lastMsg.sender}: ${lastMsg.message}` : 'No messages yet'}
            </Text>
            {item.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unread_count}</Text>
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
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        {/* ── Not signed in ───────────────────────────────────────── */}
        {!isAuthenticated ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons name="message-outline" size={48} color={Brand.textTertiary} />
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
              <MaterialCommunityIcons name="chevron-right" size={22} color={Brand.textTertiary} />
            </Pressable>

            {threads.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <MaterialCommunityIcons name="message-off-outline" size={48} color={Brand.textTertiary} />
                </View>
                <Text style={styles.emptyTitle}>No conversations yet</Text>
                <Text style={styles.emptySubtext}>Start chatting with suppliers from their store pages</Text>
                <Pressable style={styles.browseBtn} onPress={() => router.push('/suppliers' as any)}>
                  <Text style={styles.browseBtnText}>Browse Suppliers</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={threads}
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
              />
            )}
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },

  // ── List ────────────────────────────────────────────────────────
  list: { paddingVertical: 8 },

  // ── Support banner ──────────────────────────────────────────────
  supportBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Brand.text,
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  supportIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportInfo: { flex: 1, gap: 2 },
  supportTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  supportSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.surfaceAlt,
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
    position: 'absolute',
    top: 0, right: 0,
    width: 12, height: 12,
    borderRadius: 6,
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cardBody: { flex: 1, gap: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  storeName: { flex: 1, fontSize: 15, fontWeight: '700', color: Brand.text },
  time: { fontSize: 11, color: Brand.textTertiary },
  productName: { fontSize: 12, color: Brand.primary, fontWeight: '500' },
  lastMsgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  lastMsg: { flex: 1, fontSize: 13, color: Brand.textSecondary },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: Brand.primary,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  // ── States ──────────────────────────────────────────────────────
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, color: Brand.textSecondary, fontSize: 14 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Brand.surfaceAlt,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Brand.text },
  emptySubtext: { marginTop: 8, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
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
