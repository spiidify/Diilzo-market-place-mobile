// ── Chat API Service ──────────────────────────────────────────────

import { apiRequest } from './api';
import type { ChatThread, ChatMessage, PaginatedResponse } from '../types';

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

/** POST /api/v1/chat/threads/<id>/send/ — send a message */
export async function sendChatMessage(threadId: number, message: string): Promise<ChatMessage> {
  return apiRequest<ChatMessage>({
    method: 'POST',
    url: `/chat/threads/${threadId}/send/`,
    data: { message },
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
