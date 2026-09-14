// ── Social Login Buttons ───────────────────────────────────────────
// Reusable social login buttons for Google and Facebook.
// Used on both the login and register screens.
// Uses expo-auth-session for the OAuth flow, then exchanges the
// provider token for Diilzo JWT tokens via the backend.
//
// Buttons are ALWAYS visible. If a provider is not configured (no
// client ID in env), tapping the button shows an alert explaining
// how to configure it.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import {
  useFacebookAuth,
  useGoogleAuth,
} from '@/services/socialAuth';

export function SocialLoginButtons() {
  const router = useRouter();
  const { socialLogin } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  // Hooks are always called — no conditional returns before them
  const googleAuth = useGoogleAuth();
  const facebookAuth = useFacebookAuth();

  const handleGoogle = async () => {
    if (!googleAuth.configured) {
      Alert.alert(
        'Google Sign-In Not Configured',
        'Add EXPO_PUBLIC_GOOGLE_CLIENT_ID to your .env file to enable Google sign-in.',
      );
      return;
    }
    try {
      setLoadingProvider('google');
      const result = await googleAuth.promptAsync();
      if (result?.type !== 'success') return;
      const idToken = result.params?.id_token;
      const accessToken = result.params?.access_token;
      if (!idToken && !accessToken) {
        Alert.alert('Error', 'No token received from Google.');
        return;
      }
      await socialLogin('google', { id_token: idToken, access_token: accessToken });
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Google Sign-In Failed', e?.message || 'Something went wrong.');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleFacebook = async () => {
    if (!facebookAuth.configured) {
      Alert.alert(
        'Facebook Sign-In Not Configured',
        'Add EXPO_PUBLIC_FACEBOOK_CLIENT_ID to your .env file to enable Facebook sign-in.',
      );
      return;
    }
    try {
      setLoadingProvider('facebook');
      const result = await facebookAuth.promptAsync();
      if (result?.type !== 'success') return;
      const accessToken = result.params?.access_token;
      if (!accessToken) {
        Alert.alert('Error', 'No access token received from Facebook.');
        return;
      }
      await socialLogin('facebook', { access_token: accessToken });
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Facebook Sign-In Failed', e?.message || 'Something went wrong.');
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.buttonRow}>
        {/* Google */}
        <Pressable
          style={[styles.socialBtn, loadingProvider === 'google' && styles.socialBtnDisabled]}
          onPress={handleGoogle}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === 'google' ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <MaterialCommunityIcons name="google" size={22} color={colors.text} />
          )}
        </Pressable>

        {/* Facebook */}
        <Pressable
          style={[styles.socialBtn, loadingProvider === 'facebook' && styles.socialBtnDisabled]}
          onPress={handleFacebook}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === 'facebook' ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <MaterialCommunityIcons name="facebook" size={22} color="#1877F2" />
          )}
        </Pressable>

        {/* Apple — placeholder for future development build */}
        <Pressable
          style={[styles.socialBtn, loadingProvider === 'apple' && styles.socialBtnDisabled]}
          onPress={() => Alert.alert(
            'Apple Sign-In',
            'Apple Sign-In requires a development build and will be available soon.',
          )}
          disabled={loadingProvider !== null}
        >
          <MaterialCommunityIcons name="apple" size={22} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    marginTop: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: c.border,
  },
  dividerText: {
    fontSize: 13,
    color: c.textTertiary,
    marginHorizontal: 12,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  socialBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBtnDisabled: {
    opacity: 0.5,
  },
});
