// ── Permissions Service ───────────────────────────────────────────
// Runtime permission requests for camera, microphone, and photo library.

import { Audio } from 'expo-av';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, Platform } from 'react-native';

export type PermissionStatus = 'granted' | 'denied' | 'blocked' | 'undetermined';

export interface PermissionResult {
  granted: boolean;
  status: PermissionStatus;
  message?: string;
}

/** Request camera permission. */
export async function requestCameraPermission(): Promise<PermissionResult> {
  try {
    const { status } = await Camera.requestCameraPermissionsAsync();
    return {
      granted: status === 'granted',
      status: status as PermissionStatus,
      message: status === 'granted' ? undefined : 'Camera permission is needed to take product photos and scan barcodes.',
    };
  } catch (e: any) {
    return { granted: false, status: 'denied', message: 'Unable to request camera permission.' };
  }
}

/** Request microphone permission. */
export async function requestMicrophonePermission(): Promise<PermissionResult> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return {
      granted: status === 'granted',
      status: status as PermissionStatus,
      message: status === 'granted' ? undefined : 'Microphone permission is needed for voice messages and video calls.',
    };
  } catch (e: any) {
    return { granted: false, status: 'denied', message: 'Unable to request microphone permission.' };
  }
}

/** Request photo library permission. */
export async function requestPhotoLibraryPermission(): Promise<PermissionResult> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return {
      granted: status === 'granted',
      status: status as PermissionStatus,
      message: status === 'granted' ? undefined : 'Photo library access is needed to upload product images.',
    };
  } catch (e: any) {
    return { granted: false, status: 'denied', message: 'Unable to request photo library permission.' };
  }
}

/** Check current camera permission without prompting. */
export async function checkCameraPermission(): Promise<PermissionStatus> {
  try {
    const { status } = await Camera.getCameraPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return 'undetermined';
  }
}

/** Check current microphone permission without prompting. */
export async function checkMicrophonePermission(): Promise<PermissionStatus> {
  try {
    const { status } = await Audio.getPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return 'undetermined';
  }
}

/**
 * Request all media permissions (camera + microphone + photos).
 * Returns true if all granted.
 */
export async function requestAllMediaPermissions(): Promise<boolean> {
  const camera = await requestCameraPermission();
  const mic = await requestMicrophonePermission();
  const photos = await requestPhotoLibraryPermission();
  return camera.granted && mic.granted && photos.granted;
}

/**
 * If permission is blocked, prompt the user to open Settings.
 */
export function promptOpenSettings(feature: string): void {
  Alert.alert(
    `${feature} Permission Required`,
    `Diilzo needs access to your ${feature.toLowerCase()} to use this feature. Please enable it in Settings.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => openAppSettings() },
    ],
  );
}

/** Open the device settings page for this app. */
export function openAppSettings(): void {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else {
    Linking.openSettings();
  }
}
