// ── Expo Push Notifications Service ────────────────────────────────

import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { registerPushToken } from './notifications';

let expoPushToken: string | null = null;

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    // Push notifications don't work on simulators/emulators
    return null;
  }

  try {
    // expo-notifications is not installed; this is a placeholder
    // that will be activated once the package is added.
    // When ready, uncomment the following:

    // import * as Notifications from 'expo-notifications';
    // const { status: existingStatus } = await Notifications.getPermissionsAsync();
    // let finalStatus = existingStatus;
    // if (existingStatus !== 'granted') {
    //   const { status } = await Notifications.requestPermissionsAsync();
    //   finalStatus = status;
    // }
    // if (finalStatus !== 'granted') return null;
    // const token = (await Notifications.getExpoPushTokenAsync({ projectId: 'diilzo-mobile' })).data;
    // if (Platform.OS === 'android') {
    //   Notifications.setNotificationChannelAsync('default', {
    //     name: 'default',
    //     importance: Notifications.AndroidImportance.MAX,
    //   });
    // }
    // expoPushToken = token;
    // await registerPushToken(token);
    // return token;

    return null;
  } catch (e) {
    console.error('Push notification registration error:', e);
    return null;
  }
}

export function getExpoPushToken(): string | null {
  return expoPushToken;
}
