import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { fetchChatThreads } from '@/services/chat';
import type { ChatThread } from '@/types';

export default function ChatListScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      setRefreshing(true);
      const data = await fetchChatThreads();
      setThreads(data);
    } catch (e: any) {
      console.error('Chat threads error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: ChatThread }) => {
    const lastMsg = item.last_message;
    const time = lastMsg ? new Date(lastMsg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        onPress={() => router.push(`/chat/${item.id}` as any)}
      >
        <View style={styles.avatarWrap}>
          {item.store_logo ? (
            <Image source={{ uri: item.store_logo }} style={styles.avatar} contentFit="cover" />
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
            <Text style={styles.storeName} numberOfLines={1}>{item.store_name}</Text>
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
          colors={['#ff6a00', '#ff8520', '#ff9500']}
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
              <MaterialCommunityIcons name="message-outline" size={48} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>Sign in to view messages</Text>
            <Text style={styles.emptySubtext}>Chat with suppliers and sellers</Text>
            <Pressable style={styles.signInBtn} onPress={() => router.push('/(auth)/login' as any)}>
              <Text style={styles.signInBtnText}>Sign In</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : threads.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons name="message-off-outline" size={48} color="#9CA3AF" />
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
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />
            }
          />
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
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
  storeName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1F2937' },
  time: { fontSize: 11, color: '#9CA3AF' },
  productName: { fontSize: 12, color: Brand.primary, fontWeight: '500' },
  lastMsgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  lastMsg: { flex: 1, fontSize: 13, color: '#6B7280' },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: Brand.primary,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  // ── States ──────────────────────────────────────────────────────
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, color: '#6B7280', fontSize: 14 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  emptySubtext: { marginTop: 8, fontSize: 14, color: '#6B7280', textAlign: 'center' },
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
