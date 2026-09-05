import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { BASE_URL } from '@/services/api';
import { fetchChatMessages, sendChatMessage, sendVoiceMessage } from '@/services/chat';
import type { ChatMessage } from '@/types';

// ── Audio message bubble with play/pause ───────────────────────────
function AudioBubble({ uri, duration, isMe }: { uri: string; duration: number; isMe: boolean }) {
  const player = useAudioPlayer({ uri });
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, [isPlaying, player]);

  // Reset playing state when playback finishes
  useEffect(() => {
    const id = player.addListener?.('playbackStatusUpdate', (status: any) => {
      if (status?.didJustFinish) {
        setIsPlaying(false);
      }
    });
    return () => { id?.remove?.(); };
  }, [player]);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.audioBubble, pressed && { opacity: 0.8 }]}
      onPress={togglePlay}
    >
      <MaterialCommunityIcons
        name={isPlaying ? 'pause-circle' : 'play-circle'}
        size={28}
        color={isMe ? '#FFFFFF' : Brand.primary}
      />
      <View style={styles.audioWave}>
        {/* Simple waveform bars */}
        {[6, 12, 8, 16, 10, 14, 7, 11, 9, 13, 6, 10, 8, 12, 7].map((h, i) => (
          <View
            key={i}
            style={[
              styles.audioBar,
              {
                height: h,
                backgroundColor: isMe ? 'rgba(255,255,255,0.6)' : Brand.border,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.audioDuration, isMe ? styles.msgTextMe : styles.msgTextThem]}>
        {fmtTime(duration || 0)}
      </Text>
    </Pressable>
  );
}

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const threadId = Number(id);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [storeName, setStoreName] = useState('Chat');
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const {
    isRecording,
    duration: recDuration,
    hasPermission,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  } = useVoiceRecorder();

  const load = useCallback(async () => {
    if (!threadId) return;
    try {
      const data = await fetchChatMessages(threadId);
      setMessages(data);
    } catch (e: any) {
      console.error('Chat messages error:', e?.message);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => { load(); }, [load]);

  // ── Poll for new messages every 5 seconds ───────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      load();
    }, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);
    try {
      const sent = await sendChatMessage(threadId, msg);
      setMessages((prev) => [...prev, sent]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (e: any) {
      console.error('Send message error:', e?.message);
      setInput(msg);
    } finally {
      setSending(false);
    }
  }, [input, sending, threadId]);

  const handleMicPress = useCallback(async () => {
    if (isRecording) {
      // Stop and send
      const result = await stopRecording();
      if (result && result.uri) {
        setSending(true);
        try {
          const sent = await sendVoiceMessage(threadId, result.uri, result.duration);
          setMessages((prev) => [...prev, sent]);
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } catch (e: any) {
          console.error('Voice send error:', e?.message);
        } finally {
          setSending(false);
          reset();
        }
      } else {
        reset();
      }
    } else {
      // Start recording
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording, threadId, reset]);

  const handleMicLongPress = useCallback(async () => {
    // Long press to cancel
    if (isRecording) {
      await cancelRecording();
    }
  }, [isRecording, cancelRecording]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = !!(user && item.sender === user.id);

    // Audio message
    if (item.message_type === 'audio' && item.audio_url) {
      const fullUrl = item.audio_url.startsWith('http')
        ? item.audio_url
        : `${BASE_URL.replace('/api/v1', '')}${item.audio_url}`;
      return (
        <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
          <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
            <AudioBubble uri={fullUrl} duration={item.audio_duration} isMe={isMe} />
            <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeThem]}>
              {new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      );
    }

    // Text message
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
        <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
          <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem]}>
            {item.message}
          </Text>
          <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeThem]}>
            {new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  const fmtRecDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
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
          <View style={styles.headerInfo}>
            <View style={styles.headerAvatarWrap}>
              {storeLogo ? (
                <Image source={{ uri: storeLogo }} style={styles.headerAvatar} contentFit="cover" />
              ) : (
                <View style={styles.headerAvatarFallback}>
                  <MaterialCommunityIcons name="store" size={16} color="#FFFFFF" />
                </View>
              )}
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>{storeName}</Text>
          </View>
          <View style={{ width: 24 }} />
        </LinearGradient>

        {/* ── Messages ────────────────────────────────────────────── */}
        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            inverted={false}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <MaterialCommunityIcons name="chat-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyChatText}>Start a conversation</Text>
                <Text style={styles.emptyChatSub}>Send a message or voice note below</Text>
              </View>
            }
          />
        )}

        {/* ── Input bar ───────────────────────────────────────────── */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {isRecording ? (
            // ── Recording bar ──────────────────────────────────────
            <View style={styles.recordingBar}>
              <Pressable onPress={cancelRecording} hitSlop={12}>
                <MaterialCommunityIcons name="trash-can-outline" size={24} color={Brand.danger} />
              </Pressable>
              <View style={styles.recordingInfo}>
                <View style={styles.recDot} />
                <Text style={styles.recordingTime}>{fmtRecDuration(recDuration)}</Text>
                <Text style={styles.recordingHint}>Recording... tap mic to send</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.micBtnRecording, pressed && { opacity: 0.8 }]}
                onPress={handleMicPress}
              >
                <MaterialCommunityIcons name="check" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : (
            // ── Normal input bar ───────────────────────────────────
            <View style={styles.inputBar}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Type a message..."
                placeholderTextColor={Brand.textTertiary}
                multiline
                maxLength={1000}
                editable={!sending}
              />
              {/* Mic button — visible when input is empty */}
              {!input.trim() && !sending ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.micBtn,
                    pressed && { opacity: 0.8 },
                    !hasPermission && styles.micBtnDisabled,
                  ]}
                  onPress={handleMicPress}
                  onLongPress={handleMicLongPress}
                  disabled={!hasPermission}
                >
                  <MaterialCommunityIcons name="microphone" size={22} color="#FFFFFF" />
                </Pressable>
              ) : (
                /* Send button — visible when there's text */
                <Pressable
                  style={({ pressed }) => [
                    styles.sendBtn,
                    pressed && { opacity: 0.8 },
                    (!input.trim() || sending) && styles.sendBtnDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={!input.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
                  )}
                </Pressable>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAvatarWrap: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  headerAvatar: { width: '100%', height: '100%' },
  headerAvatarFallback: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  // ── Messages ────────────────────────────────────────────────────
  messagesList: { paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1 },
  msgRow: { flexDirection: 'row', marginBottom: 10 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  msgBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  msgBubbleMe: {
    backgroundColor: Brand.primary,
    borderBottomRightRadius: 4,
  },
  msgBubbleThem: {
    backgroundColor: Brand.surfaceAlt,
    borderBottomLeftRadius: 4,
  },
  msgText: { fontSize: 14, lineHeight: 19 },
  msgTextMe: { color: '#FFFFFF' },
  msgTextThem: { color: Brand.text },
  msgTime: { fontSize: 10, marginTop: 4 },
  msgTimeMe: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  msgTimeThem: { color: Brand.textTertiary },

  // ── Audio bubble ────────────────────────────────────────────────
  audioBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 160,
  },
  audioWave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 24,
  },
  audioBar: {
    width: 3,
    borderRadius: 1.5,
  },
  audioDuration: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Empty ───────────────────────────────────────────────────────
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyChatText: { marginTop: 12, fontSize: 16, fontWeight: '600', color: Brand.textSecondary },
  emptyChatSub: { marginTop: 4, fontSize: 13, color: Brand.textTertiary },

  // ── Input bar ───────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: Brand.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: Brand.text,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#FED7AA' },

  // ── Mic button ──────────────────────────────────────────────────
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micBtnDisabled: { backgroundColor: Brand.border },

  // ── Recording bar ───────────────────────────────────────────────
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.border,
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Brand.danger,
  },
  recordingTime: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.danger,
  },
  recordingHint: {
    fontSize: 13,
    color: Brand.textTertiary,
  },
  micBtnRecording: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── States ──────────────────────────────────────────────────────
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, color: Brand.textSecondary, fontSize: 14 },
});
