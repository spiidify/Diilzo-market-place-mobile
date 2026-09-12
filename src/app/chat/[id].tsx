import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { BASE_URL, getAccessToken } from '@/services/api';
import { fetchChatMessages, fetchChatThread, sendChatMessage, sendVoiceMessage } from '@/services/chat';
import { scanMessageRisk } from '@/services/connection';
import { playSound, Sounds } from '@/services/sound';
import type { ChatMessage, ChatThread } from '@/types';

// ── Date separator helpers ────────────────────────────────────────
function formatDateSeparator(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.dateSepWrap}>
      <View style={styles.dateSepChip}>
        <Text style={styles.dateSepText}>{label}</Text>
      </View>
    </View>
  );
}

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
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [riskWarning, setRiskWarning] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('Chat');
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [productName, setProductName] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [productSlug, setProductSlug] = useState<string | null>(null);
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
      setError(null);
      const [msgs, thread] = await Promise.all([
        fetchChatMessages(threadId),
        fetchChatThread(threadId).catch(() => null as ChatThread | null),
      ]);
      setMessages(msgs);
      if (thread) {
        setStoreName(thread.store_name || 'Chat');
        setStoreLogo(thread.store_logo);
        setProductName(thread.product_name || null);
        setProductImage(thread.product_image || null);
        setProductSlug(thread.product_slug || null);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => { load(); }, [load]);

  // ── Real-time message streaming via SSE ──────────────────────────
  // Uses fetch streaming (React Native supports ReadableStream).
  // Falls back to polling if SSE is unavailable.
  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    let abortController: AbortController | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    async function connectSSE() {
      abortController = new AbortController();
      try {
        const token = await getAccessToken();
        const since = new Date(Date.now() - 1000).toISOString();
        const response = await fetch(`${BASE_URL}/chat/threads/${threadId}/stream/?since=${encodeURIComponent(since)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error('SSE unavailable');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;
          buffer += decoder.decode(value, { stream: true });
          // Parse complete SSE events (separated by \n\n)
          const events = buffer.split('\n\n');
          buffer = events.pop() || ''; // Keep incomplete event in buffer
          for (const evt of events) {
            if (evt.startsWith(':')) continue; // Heartbeat comment
            const lines = evt.split('\n');
            let data = '';
            for (const line of lines) {
              if (line.startsWith('data: ')) data = line.slice(6);
            }
            if (data) {
              try {
                const msg = JSON.parse(data);
                setMessages((prev) => {
                  if (prev.some((m) => m.id === msg.id)) return prev;
                  // Play message sound only for incoming messages (not our own)
                  if (msg.sender_id !== user?.id) {
                    playSound(Sounds.MESSAGE);
                  }
                  return [...prev, msg];
                });
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
              } catch { }
            }
          }
        }
      } catch {
        // SSE failed — fall back to polling
        if (!cancelled) {
          pollInterval = setInterval(() => load(), 5000);
        }
      }
    }

    connectSSE();

    return () => {
      cancelled = true;
      abortController?.abort();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [threadId, load]);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);
    playSound(Sounds.MESSAGE_SEND);
    // Fire-and-forget risk scan (non-blocking — never delays the actual send)
    scanMessageRisk(msg)
      .then((risk) => {
        if (risk.risk_level !== 'low' && risk.warning) {
          setRiskWarning(risk.warning);
        } else {
          setRiskWarning(null);
        }
      })
      .catch(() => { /* non-critical */ });
    try {
      setSendError(null);
      const sent = await sendChatMessage(threadId, msg);
      setMessages((prev) => [...prev, sent]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (e: any) {
      setSendError(e?.message || 'Failed to send message');
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
        playSound(Sounds.MESSAGE_SEND);
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

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMe = !!(user && item.sender === user.id);

    // Date separator: show date header when day changes
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showDateSep = !prevMsg || new Date(prevMsg.created_at).toDateString() !== new Date(item.created_at).toDateString();
    const dateSep = formatDateSeparator(item.created_at);

    // Audio message
    if (item.message_type === 'audio' && item.audio_url) {
      const fullUrl = item.audio_url.startsWith('http')
        ? item.audio_url
        : `${BASE_URL.replace('/api/v1', '')}${item.audio_url}`;
      return (
        <View>
          {showDateSep && <DateSeparator label={dateSep} />}
          <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
            <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
              <AudioBubble uri={fullUrl} duration={item.audio_duration} isMe={isMe} />
              <View style={styles.msgMetaRow}>
                <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeThem]}>
                  {new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {isMe && <MaterialCommunityIcons name="check-all" size={12} color="rgba(255,255,255,0.6)" />}
              </View>
            </View>
          </View>
        </View>
      );
    }

    // Text message
    return (
      <View>
        {showDateSep && <DateSeparator label={dateSep} />}
        <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
          <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
            <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem]}>
              {item.message}
            </Text>
            <View style={styles.msgMetaRow}>
              <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeThem]}>
                {new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {isMe && (
                <MaterialCommunityIcons
                  name={item.is_read ? 'check-all' : 'check'}
                  size={12}
                  color={item.is_read ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'}
                />
              )}
            </View>
          </View>
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
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/chat' as any);
              }
            }}
            hitSlop={12}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerInfo}>
            <View style={styles.headerAvatarWrap}>
              {storeLogo ? (
                <Image source={{ uri: storeLogo }} style={styles.headerAvatar} resizeMode="contain" />
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

        {/* ── Product context bar ─────────────────────────────────── */}
        {productName && (
          <Pressable
            style={styles.productContextBar}
            onPress={() => productSlug && router.push(`/product/${productSlug}` as any)}
          >
            {productImage ? (
              <Image source={{ uri: productImage }} style={styles.productContextImage} resizeMode="cover" />
            ) : (
              <View style={styles.productContextImagePlaceholder}>
                <MaterialCommunityIcons name="package-variant" size={18} color={Brand.textTertiary} />
              </View>
            )}
            <View style={styles.productContextInfo}>
              <Text style={styles.productContextLabel}>Discussing</Text>
              <Text style={styles.productContextName} numberOfLines={1}>{productName}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Brand.textTertiary} />
          </Pressable>
        )}

        {/* ── Messages ────────────────────────────────────────────── */}
        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
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
            maxToRenderPerBatch={15}
            windowSize={11}
            initialNumToRender={15}
            removeClippedSubviews={true}
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
            <>
              {sendError ? (
                <View style={styles.sendErrorBar}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={16} color={Brand.danger} />
                  <Text style={styles.sendErrorText}>{sendError}</Text>
                  <Pressable onPress={() => setSendError(null)} hitSlop={8}>
                    <MaterialCommunityIcons name="close" size={16} color={Brand.textTertiary} />
                  </Pressable>
                </View>
              ) : null}
              {riskWarning ? (
                <View style={styles.riskWarningBar}>
                  <MaterialCommunityIcons name="shield-alert-outline" size={16} color={Brand.rating} />
                  <Text style={styles.riskWarningText}>{riskWarning}</Text>
                  <Pressable onPress={() => setRiskWarning(null)} hitSlop={8}>
                    <MaterialCommunityIcons name="close" size={16} color={Brand.textTertiary} />
                  </Pressable>
                </View>
              ) : null}
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
            </>
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

  // ── Product context bar ──────────────────────────────────────────
  productContextBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Brand.surface, borderBottomWidth: 1, borderBottomColor: Brand.borderLight,
  },
  productContextImage: { width: 40, height: 40, borderRadius: 8, backgroundColor: Brand.surfaceAlt },
  productContextImagePlaceholder: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: Brand.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  productContextInfo: { flex: 1 },
  productContextLabel: { fontSize: 10, color: Brand.textTertiary, fontWeight: '600', textTransform: 'uppercase' },
  productContextName: { fontSize: 13, fontWeight: '600', color: Brand.text, marginTop: 1 },

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
  msgMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 2 },

  // ── Date separator ─────────────────────────────────────────────
  dateSepWrap: { alignItems: 'center', marginVertical: 12 },
  dateSepChip: {
    backgroundColor: Brand.surfaceAlt, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  dateSepText: { fontSize: 11, fontWeight: '600', color: Brand.textSecondary },

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
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  sendErrorBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FEF2F2' },
  sendErrorText: { flex: 1, fontSize: 12, color: Brand.danger },
  riskWarningBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFBEB' },
  riskWarningText: { flex: 1, fontSize: 11, color: '#92400E', lineHeight: 16 },
});
