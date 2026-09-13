// ── Biometric Authentication Service ──────────────────────────────
// Face ID / Touch ID / fingerprint authentication for sensitive actions.
// Stores user credentials securely in SecureStore so biometric login
// can authenticate with the backend (not just the device).

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'diilzo_biometric_enabled';
const BIOMETRIC_EMAIL_KEY = 'diilzo_biometric_email';
const BIOMETRIC_PASSWORD_KEY = 'diilzo_biometric_password';

/** Check if the device supports biometric authentication. */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.hasHardwareAsync();
    if (!result) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch {
    return false;
  }
}

/** Check if the user has enabled biometric auth in settings. */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Enable biometric authentication and store credentials securely.
 * The credentials are used to authenticate with the backend when the
 * user signs in with Face ID / fingerprint.
 */
export async function enableBiometric(email: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
  await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email);
  await SecureStore.setItemAsync(BIOMETRIC_PASSWORD_KEY, password);
}

/** Disable biometric authentication and clear stored credentials. */
export async function disableBiometric(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
}

/** Get stored biometric credentials (email + password). */
export async function getBiometricCredentials(): Promise<{ email: string; password: string } | null> {
  try {
    const email = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
    const password = await SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY);
    if (!email || !password) return null;
    return { email, password };
  } catch {
    return null;
  }
}

/** Enable or disable biometric authentication. */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
  } else {
    await disableBiometric();
  }
}

/**
 * Authenticate the user with biometrics.
 * Returns true on success, false on failure or cancellation.
 */
export async function authenticateWithBiometrics(
  promptMessage = 'Authenticate to continue'
): Promise<boolean> {
  try {
    const available = await isBiometricAvailable();
    if (!available) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use Password',
      disableDeviceFallback: false,
    });

    return result.success;
  } catch {
    return false;
  }
}

/** Get the type of biometric authentication available. */
export async function getBiometricType(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Touch ID';
    }
    return 'Biometric';
  } catch {
    return 'Biometric';
  }
}
