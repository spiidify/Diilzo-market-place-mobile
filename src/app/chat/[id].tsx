import { MaterialCommunityIcons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useBadges } from '@/context/BadgeContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { BASE_URL, getAccessToken } from '@/services/api';
import { fetchChatMessages, fetchChatPresence, fetchChatThread, sendChatMessage, sendHeartbeat, sendTypingStatus, sendVoiceMessage } from '@/services/chat';
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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.dateSepWrap}>
      <View style={styles.dateSepChip}>
        <Text style={styles.dateSepText}>{label}</Text>
      </View>
    </View>
  );
}

// ── Audio message bubble with play/pause + progress ────────────────
function AudioBubble({ uri, duration, isMe }: { uri: string; duration: number; isMe: boolean }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentTime = status.currentTime || 0;
  const totalDuration = status.duration || duration || 0;
  const progress = totalDuration > 0 ? Math.min(currentTime / totalDuration, 1) : 0;
  const isFinished = status.didJustFinish || (totalDuration > 0 && currentTime >= totalDuration && !isPlaying);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      // If finished, replay from start
      if (isFinished || currentTime >= totalDuration) {
        player.seekTo(0);
      }
      player.play();
      setIsPlaying(true);
    }
  }, [isPlaying, isFinished, currentTime, totalDuration, player]);

  // Reset playing state when playback finishes
  useEffect(() => {
    if (status.didJustFinish) {
      setIsPlaying(false);
    }
  }, [status.didJustFinish]);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
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
        {/* Progress bar overlay */}
        <View style={styles.audioProgressTrack}>
          <View
            style={[
              styles.audioProgressFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: isMe ? '#FFFFFF' : Brand.primary,
              },
            ]}
          />
        </View>
        {/* Waveform bars */}
        {[6, 12, 8, 16, 10, 14, 7, 11, 9, 13, 6, 10, 8, 12, 7].map((h, i) => {
          const barProgress = i / 15;
          const isPlayed = barProgress <= progress;
          return (
            <View
              key={i}
              style={[
                styles.audioBar,
                {
                  height: h,
                  backgroundColor: isMe
                    ? (isPlayed ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)')
                    : (isPlayed ? Brand.primary : colors.border),
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={[styles.audioDuration, isMe ? styles.msgTextMe : styles.msgTextThem]}>
        {isPlaying || currentTime > 0 ? fmtTime(currentTime) : fmtTime(totalDuration)}
      </Text>
    </Pressable>
  );
}

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { refreshBadges } = useBadges();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const [buyerName, setBuyerName] = useState<string | null>(null);
  const [buyerAvatar, setBuyerAvatar] = useState<string | null>(null);
  const [buyerId, setBuyerId] = useState<number | null>(null);
  const [isSupport, setIsSupport] = useState(false);
  const [productName, setProductName] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [productSlug, setProductSlug] = useState<string | null>(null);
  const [presence, setPresence] = useState<{ online: boolean; last_seen: string; is_typing: boolean } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const lastTypingSentRef = useRef(0);
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

  // Set audio mode for playback (plays through speaker even in silent mode)
  // Wrapped in try/catch — setAudioModeAsync is not available in Expo Go
  useEffect(() => {
    try {
      setAudioModeAsync?.({ playsInSilentMode: true });
    } catch (e) {
      console.warn('setAudioModeAsync not available:', e);
    }
  }, []);

  // ── Heartbeat: send every 30s so the other party sees us as online ──
  useEffect(() => {
    if (!threadId) return;
    sendHeartbeat();
    const interval = setInterval(() => sendHeartbeat(), 30000);
    return () => clearInterval(interval);
  }, [threadId]);

  // ── Presence polling: fetch other party's online/typing status every 3s ──
  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const p = await fetchChatPresence(Number(threadId));
        if (!cancelled) setPresence({ online: p.online, last_seen: p.last_seen, is_typing: p.is_typing });
      } catch {
        // silent
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [threadId]);

  const load = useCallback(async () => {
    if (!threadId) return;
    try {
      setError(null);
      const [msgs, thread] = await Promise.all([
        fetchChatMessages(threadId),
        fetchChatThread(threadId).catch(() => null as ChatThread | null),
      ]);
      console.log('[chat] Loaded messages:', msgs.length, 'for thread', threadId);
      setMessages(msgs);
      // Refresh badge counts since loading messages marks them as read
      refreshBadges();
      if (thread) {
        setStoreName(thread.store_name || 'Chat');
        setStoreLogo(thread.store_logo);
        setBuyerName(thread.buyer_name);
        setBuyerAvatar(thread.buyer_avatar);
        setBuyerId(thread.buyer);
        setIsSupport(!!thread.is_support);
        setProductName(thread.product_name || null);
        setProductImage(thread.product_image || null);
        setProductSlug(thread.product_slug || null);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [threadId, refreshBadges]);

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
      const ac = abortController;
      try {
        const token = await getAccessToken();
        const since = new Date(Date.now() - 1000).toISOString();
        // Add a 5-second timeout — if SSE doesn't connect quickly, fall back to polling
        const timeoutId = setTimeout(() => ac.abort(), 5000);
        const response = await fetch(`${BASE_URL}/chat/threads/${threadId}/stream/?since=${encodeURIComponent(since)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          signal: ac.signal,
        });
        clearTimeout(timeoutId);

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
            let eventType = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) eventType = line.slice(7).trim();
              if (line.startsWith('data: ')) data = line.slice(6);
            }
            // Only process message events — skip presence, heartbeat, etc.
            if (!data || eventType === 'presence') continue;
            if (data) {
              try {
                const msg = JSON.parse(data);
                // Normalize SSE message format to match ChatMessage type.
                // SSE returns sender_id; the serializer returns sender.
                const normalized: ChatMessage = {
                  id: msg.id,
                  thread: msg.thread ?? threadId,
                  sender: msg.sender ?? msg.sender_id ?? 0,
                  sender_name: msg.sender_name ?? '',
                  sender_avatar: msg.sender_avatar ?? null,
                  message: msg.message ?? '',
                  message_type: msg.message_type ?? 'text',
                  audio_url: msg.audio_url ?? null,
                  audio_duration: msg.audio_duration ?? 0,
                  is_read: msg.is_read ?? false,
                  created_at: msg.created_at,
                };
                setMessages((prev) => {
                  if (prev.some((m) => m.id === normalized.id)) return prev;
                  // Play message sound only for incoming messages (not our own)
                  if (normalized.sender !== user?.id) {
                    playSound(Sounds.MESSAGE);
                  }
                  return [...prev, normalized];
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

  // ── Typing indicator: send typing status when user types ──
  const handleInputChange = useCallback((text: string) => {
    setInput(text);
    if (!threadId) return;
    const now = Date.now();
    // Throttle: only send typing status once every 2s
    if (now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      sendTypingStatus(Number(threadId), text.length > 0);
    }
    if (text.length === 0) {
      lastTypingSentRef.current = 0;
    }
  }, [threadId]);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setInput('');
    // Stop typing indicator when message is sent
    if (threadId) sendTypingStatus(Number(threadId), false);
    lastTypingSentRef.current = 0;
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
          const errDetail = e?.response?.data?.detail || e?.response?.data?.error || e?.response?.data?.audio || e?.message;
          console.error('Voice send error:', errDetail, e?.response?.data);
          setSendError(typeof errDetail === 'string' ? errDetail : 'Failed to send voice message');
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
            <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem, isSupport && (isMe ? styles.supportBubbleMe : styles.supportBubbleThem)]}>
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
          <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem, isSupport && (isMe ? styles.supportBubbleMe : styles.supportBubbleThem)]}>
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
    <View style={[styles.screen, isSupport && styles.supportScreen]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <LinearGradient
          colors={isSupport
            ? ['#1E293B', '#334155', '#475569']
            : [Brand.primaryDark, Brand.primary, Brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable
            onPress={() => {
              // Always go to the chat list (WhatsApp pattern).
              // router.back() would go to whatever screen opened the chat
              // (Home, Product detail, etc.) — but the user expects to see
              // their conversation list when leaving a chat.
              router.replace('/chat' as any);
            }}
            hitSlop={12}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerInfo}>
            <View style={styles.headerAvatarWrap}>
              {isSupport ? (
                <View style={styles.headerAvatarFallback}>
                  <MaterialCommunityIcons name="headset" size={16} color="#FFFFFF" />
                </View>
              ) : buyerId && user?.id && buyerId !== user.id ? (
                // Seller viewing — show buyer's avatar
                buyerAvatar ? (
                  <Image source={{ uri: buyerAvatar }} style={styles.headerAvatar} resizeMode="cover" />
                ) : (
                  <View style={styles.headerAvatarFallback}>
                    <MaterialCommunityIcons name="account" size={16} color="#FFFFFF" />
                  </View>
                )
              ) : storeLogo ? (
                // Buyer viewing — show store logo
                <Image source={{ uri: storeLogo }} style={styles.headerAvatar} resizeMode="contain" />
              ) : (
                // Buyer viewing — no store logo, show store icon
                <View style={styles.headerAvatarFallback}>
                  <MaterialCommunityIcons name="store" size={16} color="#FFFFFF" />
                </View>
              )}
              {presence?.online && (
                <View style={styles.onlineDot} />
              )}
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {isSupport
                  ? 'Diilzo Support'
                  : (buyerId && user?.id && buyerId === user.id
                    ? (storeName || 'Chat')
                    : (buyerName || storeName || 'Chat'))}
              </Text>
              <Text style={styles.headerStatus} numberOfLines={1}>
                {presence?.is_typing
                  ? 'typing...'
                  : presence?.online
                    ? 'online'
                    : presence?.last_seen || 'offline'}
              </Text>
            </View>
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
                <MaterialCommunityIcons name="package-variant" size={18} color={colors.textTertiary} />
              </View>
            )}
            <View style={styles.productContextInfo}>
              <Text style={styles.productContextLabel}>Discussing</Text>
              <Text style={styles.productContextName} numberOfLines={1}>{productName}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
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
            contentContainerStyle={[styles.messagesList, isSupport && styles.supportMessagesList]}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            inverted={false}
            maxToRenderPerBatch={15}
            windowSize={11}
            initialNumToRender={15}
            removeClippedSubviews={true}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <MaterialCommunityIcons name="chat-outline" size={48} color={colors.textTertiary} />
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
                    <MaterialCommunityIcons name="close" size={16} color={colors.textTertiary} />
                  </Pressable>
                </View>
              ) : null}
              {riskWarning ? (
                <View style={styles.riskWarningBar}>
                  <MaterialCommunityIcons name="shield-alert-outline" size={16} color={Brand.rating} />
                  <Text style={styles.riskWarningText}>{riskWarning}</Text>
                  <Pressable onPress={() => setRiskWarning(null)} hitSlop={8}>
                    <MaterialCommunityIcons name="close" size={16} color={colors.textTertiary} />
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.inputBar}>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={handleInputChange}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.textTertiary}
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

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surface },
  supportScreen: { backgroundColor: '#F1F5F9' },
  safeArea: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAvatarWrap: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', position: 'relative' },
  headerAvatar: { width: '100%', height: '100%' },
  headerAvatarFallback: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#16A34A', borderWidth: 2, borderColor: '#FFFFFF',
  },
  headerTextWrap: { flex: 1, gap: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  headerStatus: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

  // ── Product context bar ──────────────────────────────────────────
  productContextBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.borderLight,
  },
  productContextImage: { width: 40, height: 40, borderRadius: 8, backgroundColor: c.surfaceAlt },
  productContextImagePlaceholder: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: c.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  productContextInfo: { flex: 1 },
  productContextLabel: { fontSize: 10, color: c.textTertiary, fontWeight: '600', textTransform: 'uppercase' },
  productContextName: { fontSize: 13, fontWeight: '600', color: c.text, marginTop: 1 },

  // ── Messages ────────────────────────────────────────────────────
  messagesList: { paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1 },
  supportMessagesList: { backgroundColor: '#F1F5F9' },
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
    backgroundColor: c.surfaceAlt,
    borderBottomLeftRadius: 4,
  },
  supportBubbleMe: {
    backgroundColor: '#1E293B',
  },
  supportBubbleThem: {
    backgroundColor: '#E2E8F0',
  },
  msgText: { fontSize: 14, lineHeight: 19 },
  msgTextMe: { color: '#FFFFFF' },
  msgTextThem: { color: c.text },
  msgTime: { fontSize: 10, marginTop: 4 },
  msgTimeMe: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  msgTimeThem: { color: c.textTertiary },
  msgMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 2 },

  // ── Date separator ─────────────────────────────────────────────
  dateSepWrap: { alignItems: 'center', marginVertical: 12 },
  dateSepChip: {
    backgroundColor: c.surfaceAlt, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  dateSepText: { fontSize: 11, fontWeight: '600', color: c.textSecondary },

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
    position: 'relative',
  },
  audioProgressTrack: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 1,
    transform: [{ translateY: -1 }],
    overflow: 'hidden',
  },
  audioProgressFill: {
    height: '100%',
    borderRadius: 1,
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
  emptyChatText: { marginTop: 12, fontSize: 16, fontWeight: '600', color: c.textSecondary },
  emptyChatSub: { marginTop: 4, fontSize: 13, color: c.textTertiary },

  // ── Input bar ───────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: c.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: c.text,
    borderWidth: 1,
    borderColor: c.border,
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
  micBtnDisabled: { backgroundColor: c.border },

  // ── Recording bar ───────────────────────────────────────────────
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
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
    color: c.textTertiary,
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
  loadingText: { marginTop: 8, color: c.textSecondary, fontSize: 14 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  sendErrorBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FEF2F2' },
  sendErrorText: { flex: 1, fontSize: 12, color: Brand.danger },
  riskWarningBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFBEB' },
  riskWarningText: { flex: 1, fontSize: 11, color: '#92400E', lineHeight: 16 },
});
