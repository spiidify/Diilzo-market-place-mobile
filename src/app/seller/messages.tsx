import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import {
  getSellerThreadDetail,
  getSellerThreads,
  sendSellerMessage,
  type SellerMessage,
  type SellerThread,
  type SellerThreadDetail,
} from '@/services/seller';

export default function SellerMessagesScreen() {
  const router = useRouter();
  const [threads, setThreads] = useState<SellerThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeThread, setActiveThread] = useState<SellerThreadDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getSellerThreads();
      setThreads(data);
    } catch (e: any) {
      console.error('Messages error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openThread = async (id: number) => {
    setThreadLoading(true);
    setActiveThread(null);
    try {
      const data = await getSellerThreadDetail(id);
      setActiveThread(data);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    } catch {
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setThreadLoading(false);
    }
  };

  const handleSend = async () => {
    if (!activeThread || !replyText.trim()) return;
    setSending(true);
    try {
      const newMsg = await sendSellerMessage(activeThread.thread_id, replyText.trim());
      setActiveThread({
        ...activeThread,
        messages: [...activeThread.messages, {
          id: newMsg.id,
          message: newMsg.message,
          is_me: true,
          sender_name: 'You',
          created_at: newMsg.created_at,
        } as SellerMessage],
      });
      setReplyText('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const renderThread = ({ item }: { item: SellerThread }) => (
    <Pressable style={({ pressed }) => [styles.threadCard, pressed && { opacity: 0.85 }]} onPress={() => openThread(item.id)}>
      <View style={styles.threadAvatar}>
        <MaterialCommunityIcons name={item.is_support ? "headset" : "account"} size={22} color={Brand.primary} />
      </View>
      <View style={styles.threadInfo}>
        <View style={styles.threadHeader}>
          <Text style={styles.threadName} numberOfLines={1}>{item.buyer_name}</Text>
          {item.unread_count > 0 && <View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.unread_count}</Text></View>}
        </View>
        {item.product_name && <Text style={styles.threadProduct} numberOfLines={1}>{item.product_name}</Text>}
        <Text style={styles.threadLastMsg} numberOfLines={1}>{item.last_message || 'No messages yet'}</Text>
      </View>
      {item.last_message_time && <Text style={styles.threadTime}>{new Date(item.last_message_time).toLocaleDateString()}</Text>}
    </Pressable>
  );

  const renderMessage = ({ item }: { item: SellerMessage }) => (
    <View style={[styles.msgRow, item.is_me ? styles.msgRowMe : styles.msgRowThem]}>
      <View style={[styles.msgBubble, item.is_me ? styles.msgBubbleMe : styles.msgBubbleThem]}>
        <Text style={[styles.msgText, item.is_me && styles.msgTextMe]}>{item.message}</Text>
        <Text style={[styles.msgTime, item.is_me && styles.msgTimeMe]}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.primary, Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => activeThread ? setActiveThread(null) : router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>{activeThread ? activeThread.buyer_name : 'Messages'}</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        {activeThread ? (
          <View style={styles.chatContainer}>
            {activeThread.product_name && (
              <View style={styles.productBar}>
                <MaterialCommunityIcons name="package-variant" size={16} color={Brand.primary} />
                <Text style={styles.productBarText} numberOfLines={1}>{activeThread.product_name}</Text>
              </View>
            )}
            {threadLoading ? (
              <ActivityIndicator size="large" color={Brand.primary} style={{ flex: 1 }} />
            ) : (
              <FlatList
                ref={flatListRef}
                data={activeThread.messages}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderMessage}
                contentContainerStyle={styles.chatList}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              />
            )}
            <View style={styles.inputBar}>
              <TextInput
                style={styles.replyInput}
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Type a message..."
                placeholderTextColor={Brand.textTertiary}
                multiline
                maxLength={1000}
              />
              <Pressable style={({ pressed }) => [styles.sendBtn, (sending || pressed) && { opacity: 0.7 }]} onPress={handleSend} disabled={sending || !replyText.trim()}>
                {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />}
              </Pressable>
            </View>
          </View>
        ) : loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={threads}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderThread}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="chat-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No messages</Text>
                <Text style={styles.emptySub}>Buyer conversations will appear here</Text>
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
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  threadCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  threadAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.primary + '12', justifyContent: 'center', alignItems: 'center' },
  threadInfo: { flex: 1, gap: 2 },
  threadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  threadName: { fontSize: 14, fontWeight: '800', color: Brand.text, flex: 1 },
  unreadBadge: { backgroundColor: Brand.danger, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  unreadText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  threadProduct: { fontSize: 12, fontWeight: '600', color: Brand.primary },
  threadLastMsg: { fontSize: 12, color: Brand.textTertiary },
  threadTime: { fontSize: 11, color: Brand.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
  chatContainer: { flex: 1, backgroundColor: Brand.surfaceAlt },
  productBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Brand.borderLight },
  productBarText: { flex: 1, fontSize: 13, fontWeight: '600', color: Brand.text },
  chatList: { padding: 12, paddingBottom: 80 },
  msgRow: { flexDirection: 'row', marginBottom: 8 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  msgBubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  msgBubbleMe: { backgroundColor: Brand.primary, borderBottomRightRadius: 4 },
  msgBubbleThem: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, elevation: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  msgText: { fontSize: 14, color: Brand.text },
  msgTextMe: { color: '#FFFFFF' },
  msgTime: { fontSize: 10, color: Brand.textTertiary, marginTop: 4, alignSelf: 'flex-end' },
  msgTimeMe: { color: 'rgba(255,255,255,0.7)' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: Brand.borderLight },
  replyInput: { flex: 1, borderWidth: 1.5, borderColor: Brand.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: Brand.text, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.primary, justifyContent: 'center', alignItems: 'center' },
});
