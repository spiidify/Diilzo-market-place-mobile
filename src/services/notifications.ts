// ── Notification API Service ──────────────────────────────────────

import { apiRequest } from './api';

export interface AppNotification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  link_url: string;
}

/** GET /api/v1/notifications/ — list user notifications */
export async function fetchNotifications(): Promise<AppNotification[]> {
  return apiRequest<AppNotification[]>({ method: 'GET', url: '/notifications/' });
}

/** POST /api/v1/notifications/<id>/read/ — mark as read */
export async function markNotificationRead(id: number): Promise<void> {
  await apiRequest({ method: 'POST', url: `/notifications/${id}/read/` });
}

/** POST /api/v1/notifications/read-all/ — mark all as read */
export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest({ method: 'POST', url: '/notifications/read-all/' });
}

/** POST /api/v1/notifications/push-token/ — register Expo push token */
export async function registerPushToken(token: string): Promise<void> {
  await apiRequest({ method: 'POST', url: '/notifications/push-token/', data: { token } });
}
