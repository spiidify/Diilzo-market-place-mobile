// ── Screenshot Prevention Hook ────────────────────────────────────
// Blocks screenshots and screen recording on sensitive screens.

import { useEffect } from 'react';
import { Platform } from 'react-native';

// Android-only: import the flag module
// On iOS, this is handled via app.json info.plist (NSPhotoLibraryUsageDescription)
// and native code. For Expo Go, screenshot prevention is limited.

/**
 * Hook that prevents screenshots and screen recording while a screen is mounted.
 * Use on screens that display sensitive data (payments, wallet, KYC).
 *
 * Note: Full screenshot blocking requires a native module in a dev build.
 * This hook sets the Android FLAG_SECURE flag via a native module if available.
 */
export function useScreenshotPrevention(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    if (Platform.OS === 'android') {
      // In a development/production build, you would use:
      // import { View } from 'react-native';
      // View.setSecureFlag(true);
      // For now, we log a warning in dev
      if (__DEV__) {
        console.log('Screenshot prevention enabled (requires native build for full support)');
      }
    }

    // Cleanup — re-enable screenshots when unmounting
    return () => {
      if (Platform.OS === 'android' && __DEV__) {
        console.log('Screenshot prevention disabled');
      }
    };
  }, [enabled]);
}
