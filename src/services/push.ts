// ── Expo Push Notifications Service (SDK 57) ────────────────────────
//
// Implements push notification registration, token persistence, and
// notification handling using expo-notifications. Follows the official
// Expo SDK 57 documentation:
// https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
//
// Push notifications require a development build (not Expo Go on Android
// from SDK 53+). This module detects Expo Go and skips registration
// entirely to avoid import-time warnings from expo-notifications.
//
// expo-notifications is loaded lazily (dynamic import) so that the
// module is never evaluated in Expo Go — this prevents the SDK 53
// warnings from appearing in the console.

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { registerPushToken } from './notifications';

// Detect Expo Go — push notifications are unsupported here since SDK 53.
// Using executionEnvironment avoids importing expo-notifications at all.
function isExpoGo(): boolean {
  return (Constants.executionEnvironment as string) === 'store';
}

// Cache the dynamically-imported expo-notifications module.
let NotificationsModule: typeof import('expo-notifications') | null = null;
let notificationHandlerConfigured = false;

async function getNotifications() {
  if (!NotificationsModule) {
    NotificationsModule = await import('expo-notifications');
    // Configure the notification handler once — controls how notifications
    // are presented while the app is in the foreground.
    if (!notificationHandlerConfigured) {
      NotificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      notificationHandlerConfigured = true;
    }
  }
  return NotificationsModule;
}

let expoPushToken: string | null = null;

/**
 * Register the device for push notifications and persist the token
 * to the backend via POST /api/v1/notifications/push-token/.
 *
 * Returns the Expo push token string, or null if:
 * - Running in Expo Go (push not supported since SDK 53)
 * - Running on a simulator/emulator (no push token available)
 * - Permission was denied
 * - No valid EAS projectId is configured
 * - Token registration failed
 *
 * Safe to call multiple times — re-registers and re-persists.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Skip entirely in Expo Go — push notifications are not supported.
  if (isExpoGo()) {
    return null;
  }

  // Push notifications require a physical device
  if (!Device.isDevice) {
    return null;
  }

  try {
    const Notifications = await getNotifications();

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
      return null;
    }

    // Get the Expo push token using the EAS projectId
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
      // projectId is missing or not a valid UUID. Push notifications require
      // an EAS project — run `eas init` to create one and populate app.json.
      // Silent in Expo Go; only warn in development builds.
      if (!isExpoGo()) {
        console.warn(
          'Push notifications disabled: no valid EAS projectId found.\n' +
          'Run `eas init` to create an EAS project and add the projectId to app.json.'
        );
      }
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    expoPushToken = tokenResponse.data;

    // Persist the token to the backend
    try {
      await registerPushToken(expoPushToken);
    } catch (e) {
      // Non-critical — token is still valid locally, will retry on next launch
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
 * Returns an unsubscribe function. No-op in Expo Go.
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
  listener: (notification: any) => void,
): { remove: () => void } {
  // Fire-and-forget — the listener is attached once the module loads.
  // In Expo Go this never resolves (module not loaded), which is fine.
  let subscription: { remove: () => void } = { remove: () => { } };
  if (!isExpoGo()) {
    getNotifications().then((Notifications) => {
      subscription = Notifications.addNotificationReceivedListener(listener);
    });
  }
  return {
    remove: () => subscription.remove(),
  };
}

/**
 * Subscribe to notification interactions (when the user taps a notification).
 * Returns an unsubscribe function. Use this for deep-link navigation.
 * No-op in Expo Go.
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
  listener: (response: any) => void,
): { remove: () => void } {
  let subscription: { remove: () => void } = { remove: () => { } };
  if (!isExpoGo()) {
    getNotifications().then((Notifications) => {
      subscription = Notifications.addNotificationResponseReceivedListener(listener);
    });
  }
  return {
    remove: () => subscription.remove(),
  };
}

/**
 * Get the last notification that launched the app (if the app was
 * launched by tapping a notification). Useful for initial deep-linking.
 * Returns null in Expo Go.
 */
export async function getLastNotificationResponse(): Promise<any | null> {
  if (isExpoGo()) return null;
  const Notifications = await getNotifications();
  return await Notifications.getLastNotificationResponseAsync();
}
