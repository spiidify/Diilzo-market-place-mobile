// ── Expo Push Notifications Service (SDK 57) ────────────────────────
//
// Implements push notification registration, token persistence, and
// notification handling using expo-notifications. Follows the official
// Expo SDK 57 documentation:
// https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
//
// Push notifications require a development build (not Expo Go on Android
// from SDK 53+). Local notifications still work in Expo Go.

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerPushToken } from './notifications';

// Configure the notification handler — this controls how notifications
// are presented while the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let expoPushToken: string | null = null;

/**
 * Register the device for push notifications and persist the token
 * to the backend via POST /api/v1/notifications/push-token/.
 *
 * Returns the Expo push token string, or null if:
 * - Running on a simulator/emulator (no push token available)
 * - Permission was denied
 * - Token registration failed
 *
 * Safe to call multiple times — re-registers and re-persists.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications require a physical device
  if (!Device.isDevice) {
    console.log('Push notifications are not available on simulators/emulators.');
    return null;
  }

  try {
    // Android requires a notification channel before the permissions prompt
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Diilzo Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // Request permission (idempotent — returns existing status if already granted)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted.');
      return null;
    }

    // Get the Expo push token using the EAS projectId
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    if (!projectId) {
      console.error('No EAS projectId found in app config.');
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    expoPushToken = tokenResponse.data;

    // Persist the token to the backend
    try {
      await registerPushToken(expoPushToken);
    } catch (e) {
      // Non-critical — token is still valid locally, will retry on next launch
      console.warn('Failed to register push token with backend:', e);
    }

    return expoPushToken;
  } catch (e) {
    console.error('Push notification registration error:', e);
    return null;
  }
}

/**
 * Returns the last-registered Expo push token (or null if not registered).
 */
export function getExpoPushToken(): string | null {
  return expoPushToken;
}

/**
 * Subscribe to incoming notifications while the app is in the foreground.
 * Returns an unsubscribe function.
 *
 * Usage:
 *   useEffect(() => {
 *     const unsub = addNotificationReceivedListener((notif) => {
 *       console.log('Received:', notif);
 *     });
 *     return unsub;
 *   }, []);
 */
export function addNotificationReceivedListener(
  listener: (notification: Notifications.Notification) => void,
): { remove: () => void } {
  return Notifications.addNotificationReceivedListener(listener);
}

/**
 * Subscribe to notification interactions (when the user taps a notification).
 * Returns an unsubscribe function. Use this for deep-link navigation.
 *
 * Usage:
 *   useEffect(() => {
 *     const unsub = addNotificationResponseListener((response) => {
 *       const url = response.notification.request.content.data?.url;
 *       if (url) router.push(url);
 *     });
 *     return unsub;
 *   }, []);
 */
export function addNotificationResponseListener(
  listener: (response: Notifications.NotificationResponse) => void,
): { remove: () => void } {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

/**
 * Get the last notification that launched the app (if the app was
 * launched by tapping a notification). Useful for initial deep-linking.
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync();
}
