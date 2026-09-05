// ── Chat API Service ──────────────────────────────────────────────

import type { ChatMessage, ChatThread, PaginatedResponse } from '../types';
import api, { apiRequest } from './api';

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
export async function createChatThread(storeSlug: string, productId?: number): Promise<ChatThread> {
  const data: Record<string, any> = { store_slug: storeSlug };
  if (productId) data.product_id = productId;
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
  return data.results;
}

/** POST /api/v1/chat/threads/<id>/send/ — send a text message */
export async function sendChatMessage(threadId: number, message: string): Promise<ChatMessage> {
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

  const response = await api.post<ChatMessage>(
    `/chat/threads/${threadId}/send/`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    }
  );
  return response.data;
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
