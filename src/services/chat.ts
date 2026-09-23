// ── Chat API Service ──────────────────────────────────────────────

import type { ChatMessage, ChatThread, PaginatedResponse } from '../types';
import api, { apiRequest, BASE_URL, getAccessToken } from './api';
import { getMessageContactWarning } from './connection';

/** GET /api/v1/chat/threads/ — list user's chat threads */
export async function fetchChatThreads(): Promise<ChatThread[]> {
  const data = await apiRequest<PaginatedResponse<ChatThread>>({
    method: 'GET',
    url: '/chat/threads/',
  });
  return data.results;
}

/** GET /api/v1/chat/threads/<id>/ — thread detail */
export async function fetchChatThread(threadId: number): Promise<ChatThread> {
  return apiRequest<ChatThread>({
    method: 'GET',
    url: `/chat/threads/${threadId}/`,
  });
}

/** POST /api/v1/chat/threads/create/ — start or get a thread with a store */
export async function createChatThread(
  storeSlug: string,
  productId?: number,
  orderId?: number
): Promise<ChatThread> {
  const data: Record<string, any> = { store_slug: storeSlug };
  if (productId) data.product_id = productId;
  if (orderId) data.order_id = orderId;
  return apiRequest<ChatThread>({
    method: 'POST',
    url: '/chat/threads/create/',
    data,
  });
}

/** GET /api/v1/chat/threads/<id>/messages/ — list messages in a thread */
export async function fetchChatMessages(threadId: number): Promise<ChatMessage[]> {
  const data = await apiRequest<PaginatedResponse<ChatMessage> | ChatMessage[]>({
    method: 'GET',
    url: `/chat/threads/${threadId}/messages/`,
  });
  // Handle both paginated and non-paginated responses
  if (Array.isArray(data)) return data;
  // Safety: if results is missing or not an array, return empty
  if (!data || !Array.isArray(data.results)) {
    console.warn('[chat] Unexpected messages response format:', typeof data, data);
    return [];
  }
  return data.results;
}

/** POST /api/v1/chat/threads/<id>/send/ — send a text message */
export async function sendChatMessage(threadId: number, message: string): Promise<ChatMessage> {
  const warning = getMessageContactWarning(message);
  if (warning) throw new Error(warning);

  return apiRequest<ChatMessage>({
    method: 'POST',
    url: `/chat/threads/${threadId}/send/`,
    data: { message },
  });
}

/** POST /api/v1/chat/threads/<id>/send/ — send a voice message (multipart) */
export async function sendVoiceMessage(
  threadId: number,
  audioUri: string,
  durationSec: number
): Promise<ChatMessage> {
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: `voice_${Date.now()}.m4a`,
  } as any);
  formData.append('audio_duration', String(Math.round(durationSec)));

  // Use XMLHttpRequest — the most reliable way to upload files in React
  // Native. Both axios and fetch have issues with FormData file parts on
  // certain RN platforms ("The submitted data was not a file" / 
  // "Unsupported FormDataPart implementation undefined").
  const token = await getAccessToken();
  const url = `${BASE_URL}/chat/threads/${threadId}/send/`;

  return new Promise<ChatMessage>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(new Error('Invalid response from server'));
        }
      } else {
        let errData: any = null;
        try { errData = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
        console.error('sendVoiceMessage error:', { status: xhr.status, data: errData });
        const err: any = new Error(`Voice send failed: ${xhr.status}`);
        err.response = { status: xhr.status, data: errData };
        reject(err);
      }
    };

    xhr.onerror = () => {
      console.error('sendVoiceMessage network error');
      reject(new Error('Network error while sending voice message'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Voice upload timed out'));
    };

    xhr.timeout = 30000;
    xhr.send(formData);
  });
}

/** GET /api/v1/chat/unread/ — total unread count */
export async function getChatUnreadCount(): Promise<number> {
  const data = await apiRequest<{ unread_count: number }>({
    method: 'GET',
    url: '/chat/unread/',
  });
  return data.unread_count;
}

/** POST /api/v1/chat/support/create/ — start or get a support chat with Diilzo staff */
export async function createSupportChat(): Promise<ChatThread> {
  return apiRequest<ChatThread>({
    method: 'POST',
    url: '/chat/support/create/',
  });
}

// ── Presence / Typing ──────────────────────────────────────────────

export interface ChatPresence {
  online: boolean;
  last_seen: string;
  is_typing: boolean;
  user_id: number | null;
  user_name: string;
}

/** POST /api/v1/chat/heartbeat/ — update caller's last_seen timestamp */
export async function sendHeartbeat(): Promise<void> {
  try {
    await api.post('/chat/heartbeat/', {});
  } catch {
    // Silent fail — heartbeat is best-effort
  }
}

/** POST /api/v1/chat/threads/<id>/typing/ — broadcast typing status */
export async function sendTypingStatus(threadId: number, isTyping: boolean): Promise<void> {
  try {
    await api.post(`/chat/threads/${threadId}/typing/`, { is_typing: isTyping });
  } catch {
    // Silent fail — typing is best-effort
  }
}

/** GET /api/v1/chat/threads/<id>/presence/ — get other party's presence */
export async function fetchChatPresence(threadId: number): Promise<ChatPresence> {
  const { data } = await api.get<ChatPresence>(`/chat/threads/${threadId}/presence/`);
  return data;
}
